#!/usr/bin/env python3
"""RADIO CLUB 远程部署脚本。

用法（PowerShell / Git Bash）：
    export RC_SSH_PASS='你的服务器密码'
    python tools/deploy.py                  # 构建 + 上传 + 重载 nginx
    python tools/deploy.py --no-build       # 跳过构建，只上传现有 dist
    python tools/deploy.py --api-only       # 只更新后端 API 文件并重启服务

需要的环境：
    pip install paramiko
    目标机 ubuntu 用户需有免密 sudo（当前 101.42.158.132 已具备）

部署目标：
    静态站点 -> /var/www/radio-club   （nginx 8080 default_server；80 是领导的统一制品管理更新平台，别动）
    后端 API -> /opt/rc-api           （systemd rc-api，127.0.0.1:8091）
    访问地址 -> http://101.42.158.132:8080/
"""
import os, sys, time, subprocess, tarfile, tempfile

try:
    import paramiko
except ImportError:
    sys.exit('缺少 paramiko：pip install paramiko')

HOST = os.environ.get('RC_HOST', '101.42.158.132')
USER = os.environ.get('RC_SSH_USER', 'ubuntu')
WEBROOT = '/var/www/radio-club'
APIROOT = '/opt/rc-api'
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def sh(cmd, cwd=REPO):
    r = subprocess.run(cmd, cwd=cwd, shell=True, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit('命令失败: %s\n%s' % (cmd, r.stderr[-800:]))
    return r.stdout.strip()


def main():
    args = sys.argv[1:]
    password = os.environ.get('RC_SSH_PASS')
    if not password:
        sys.exit('请先设置环境变量 RC_SSH_PASS（服务器密码），不要写进脚本')

    if '--api-only' not in args:
        if '--no-build' not in args:
            print('[1/4] 本地构建…')
            print('  ', sh('npm run build').splitlines()[-1])
        else:
            print('[1/4] 跳过构建，使用现有 dist')
        print('[2/4] 打包 dist…')
        tmp = os.path.join(tempfile.gettempdir(), 'rc-dist.tar.gz')
        with tarfile.open(tmp, 'w:gz') as t:
            t.add(os.path.join(REPO, 'dist'), arcname='.')
        print('    %.1f MB' % (os.path.getsize(tmp) / 1048576))
    else:
        tmp = None

    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=password, timeout=30)

    def run(cmd, timeout=300):
        i, o, e = c.exec_command(cmd, timeout=timeout)
        out = o.read().decode('utf-8', 'replace').strip()
        err = e.read().decode('utf-8', 'replace').strip()
        return out, err, o.channel.recv_exit_status()

    if tmp:
        print('[3/4] 上传并解压到 %s…' % WEBROOT)
        sftp = c.open_sftp()
        remote = '/tmp/rc-dist.tar.gz'
        t0 = time.time()
        sftp.put(tmp, remote)
        print('    上传 %.1f MB / %.1fs' % (sftp.stat(remote).st_size / 1048576, time.time() - t0))
        sftp.close()
        out, err, rc = run('sudo rm -rf %s && sudo mkdir -p %s && sudo tar -xzf %s -C %s '
                           '&& sudo chown -R www-data:www-data %s '
                           '&& sudo find %s -type d -exec chmod 755 {} + '
                           '&& sudo find %s -type f -exec chmod 644 {} + '
                           '&& find %s -type f | wc -l'
                           % (WEBROOT, WEBROOT, remote, WEBROOT, WEBROOT, WEBROOT, WEBROOT, WEBROOT))
        if rc != 0:
            sys.exit('解压失败: ' + err)
        print('    线上文件数:', out)

    print('[4/4] 同步后端并重载服务…')
    sftp = c.open_sftp()
    pairs = [('server/api.cjs', 'server/api.cjs'),
             ('server/file-repo.cjs', 'server/file-repo.cjs'),
             ('cloudfunctions/treehole/application.js', 'cloudfunctions/treehole/application.js'),
             ('cloudfunctions/treehole/service.js', 'cloudfunctions/treehole/service.js'),
             ('cloudfunctions/treehole/index.js', 'cloudfunctions/treehole/index.js')]
    for rel, remote_rel in pairs:
        local = os.path.join(REPO, rel.replace('/', os.sep))
        if os.path.exists(local):
            sftp.put(local, APIROOT + '/' + remote_rel)
    sftp.close()
    out, err, rc = run('sudo systemctl restart rc-api && sleep 1 && sudo systemctl is-active rc-api')
    print('    rc-api:', out or err)
    out, err, rc = run('sudo nginx -t 2>&1 | tail -1 && sudo systemctl reload nginx && sleep 1 && sudo systemctl is-active nginx')
    print('    nginx:', (out or err).splitlines()[-1] if out or err else '')

    print('\n验证：')
    for p in ['/', '/tarot.html', '/masters.html', '/dreams.html', '/api/health', '/nope']:
        out, err, rc = run("curl -s -o /dev/null -w '%%{http_code}' --max-time 8 http://127.0.0.1:8080%s" % p)
        print('   %-16s -> %s' % (p, out))

    c.close()
    print('\n部署完成：http://%s:8080/' % HOST)


if __name__ == '__main__':
    main()

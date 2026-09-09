/* Mechanical resizing/encoding only; original artwork stays in assets/img. */
const sharp=require('sharp');
const fs=require('node:fs');
const path=require('node:path');
const dir=path.resolve(__dirname,'../assets/img');
(async()=>{
  const stats=[];
  for(const file of fs.readdirSync(dir).filter(f=>/^(master-|puppet-|about2006-ch).*\.png$/.test(f)&&!/-\d+\.png$/.test(f))){
    const base=file.slice(0,-4),sizes=base.startsWith('master-')?[160,320,640]:[384,768];
    for(const width of sizes)await sharp(path.join(dir,file)).resize({width,withoutEnlargement:true}).webp({quality:85,alphaQuality:100,effort:6}).toFile(path.join(dir,base+'-'+width+'.webp'));
    const width=sizes[1];
    if(base.startsWith('master-'))await sharp(path.join(dir,file)).resize({width}).png({compressionLevel:9}).toFile(path.join(dir,base+'-'+width+'.png'));
    stats.push({file,before:fs.statSync(path.join(dir,file)).size,primary:fs.statSync(path.join(dir,base+'-'+width+'.webp')).size});
  }
  console.log(JSON.stringify(stats,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});

import { cp, copyFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
const root=process.cwd(),out=join(root,"dist","client");await mkdir(out,{recursive:true});
const rootFiles=(await readdir(root)).filter(f=>/\.(html|css|js|ico)$/.test(f));
for(const file of rootFiles)await copyFile(join(root,file),join(out,file));
for(const dir of ["assets","login","signup","payment","checkout","activation","account","private-booking","level-test","live","lesson","admin"]){await cp(join(root,dir),join(out,dir),{recursive:true,force:true})}
console.log(`Built ${rootFiles.length} root assets and 12 route directories into dist/client.`);
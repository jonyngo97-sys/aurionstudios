import {mkdir,rm,copyFile,cp} from 'node:fs/promises';
await rm('public',{recursive:true,force:true});await mkdir('public',{recursive:true});
for(const file of ['index.html','styles.css','app.js','admin.html','admin.css','admin.js','setup.html','setup.js'])await copyFile(file,`public/${file}`);
await cp('assets','public/assets',{recursive:true});

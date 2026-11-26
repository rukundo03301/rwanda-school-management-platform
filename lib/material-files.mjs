import {ApiError} from "./platform-server.js";

export const MAX_FILE_BYTES=10*1024*1024;
export const FILE_TYPES={
 pdf:["application/pdf"],
 docx:["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
 pptx:["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
 png:["image/png"],
 jpg:["image/jpeg"],
 jpeg:["image/jpeg"],
 webp:["image/webp"]
};
export function safeFileName(name){
 const base=String(name||"").split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f<>:"|?*]/g,"").trim();
 return base.slice(-120);
}
export function fileExtension(name){
 const m=/\.([A-Za-z0-9]{2,5})$/.exec(safeFileName(name));
 return m?m[1].toLowerCase():"";
}
export function materialFileInput(body){
 const title=typeof body.title==="string"?body.title.trim():"";
 if(title.length<3||title.length>160)throw new ApiError(400,"Give the file a title of 3 to 160 letters");
 const description=typeof body.description==="string"?body.description.trim():"";
 if(description.length>1000)throw new ApiError(400,"Description is too long");
 const fileName=safeFileName(body.fileName);
 const ext=fileExtension(fileName);
 const types=FILE_TYPES[ext];
 if(!fileName||!types)throw new ApiError(400,"Upload a PDF, Word (.docx), PowerPoint (.pptx) or image (PNG, JPG, WebP) file");
 const mime=String(body.mimeType||"");
 if(!types.includes(mime))throw new ApiError(400,"The file type does not match its name");
 const size=Number(body.size);
 if(!Number.isInteger(size)||size<1||size>MAX_FILE_BYTES)throw new ApiError(400,"Files must be 1 byte to 10 MB");
 return {title,description,file_name:fileName,mime_type:mime,size_bytes:size,ext};
}
// Check the real first bytes, not only the name or the browser's claimed type.
export function sniffMatches(ext,bytes){
 const b=bytes;
 const at=(i,...v)=>v.every((x,k)=>b[i+k]===x);
 if(ext==="pdf")return at(0,0x25,0x50,0x44,0x46);
 if(ext==="docx"||ext==="pptx")return at(0,0x50,0x4b,0x03,0x04);
 if(ext==="png")return at(0,0x89,0x50,0x4e,0x47);
 if(ext==="jpg"||ext==="jpeg")return at(0,0xff,0xd8,0xff);
 if(ext==="webp")return at(0,0x52,0x49,0x46,0x46)&&at(8,0x57,0x45,0x42,0x50);
 return false;
}

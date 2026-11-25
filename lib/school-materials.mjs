import {ApiError} from "./platform-server.js";

// Video links must come from a known video site. Other links and documents may
// be any public https address. Never accept scripts, plain http or credentials.
const VIDEO_HOST=/^(?:www\.|m\.)?(?:youtube\.com|youtube-nocookie\.com|youtu\.be|vimeo\.com|tiktok\.com|facebook\.com|fb\.watch)$/i;
export const MATERIAL_KINDS=["video","link","document"];

export function cleanMaterialUrl(value,kind){
 if(typeof value!=="string"||value.trim().length<10||value.trim().length>500)
  throw new ApiError(400,"Paste a full web link that starts with https://");
 let u;
 try{u=new URL(value.trim());}catch{throw new ApiError(400,"That web link is not valid");}
 const host=u.hostname.toLowerCase();
 if(u.protocol!=="https:"||u.username||u.password||/\s/.test(value.trim())
   ||host==="localhost"||!host.includes(".")||/^[\d.]+$/.test(host)||host.includes(":"))
  throw new ApiError(400,"Use a public https web link");
 if(kind==="video"&&!VIDEO_HOST.test(host))
  throw new ApiError(400,"Video links must be from YouTube, Vimeo, TikTok or Facebook");
 return u.toString();
}
export function materialInput(body){
 const kind=String(body.kind||"");
 if(!MATERIAL_KINDS.includes(kind))throw new ApiError(400,"Choose video, link or document");
 const title=typeof body.title==="string"?body.title.trim():"";
 if(title.length<3||title.length>160)throw new ApiError(400,"Give the material a title of 3 to 160 letters");
 const description=typeof body.description==="string"?body.description.trim():"";
 if(description.length>1000)throw new ApiError(400,"Description is too long");
 return {title,kind,description,url:cleanMaterialUrl(body.url,kind)};
}

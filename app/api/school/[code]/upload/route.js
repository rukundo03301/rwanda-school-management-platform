import sharp from "sharp";
import {schoolContext} from "../../../../../lib/school-server.js";
import {ApiError,jsonError,checked,audit} from "../../../../../lib/platform-server.js";
export const runtime="nodejs";
export async function POST(request,{params}){
 try{
  const {code}=await params;
  const {db,school,user}=await schoolContext(request,code);
  const len=Number(request.headers.get("content-length")||0);
  if(len>6*1024*1024)throw new ApiError(413,"Image exceeds maximum allowed size");
  const form=await request.formData();
  const kind=String(form.get("kind")||"");
  // Gallery photographs use the same school-scoped folder and validation.
    if(!["logo","hero","leader","gallery"].includes(kind))throw new ApiError(400,"Choose school logo, campus photo, leader portrait or gallery photograph");
  const file=form.get("image");
  if(!(file instanceof File)||file.size===0||file.size>5*1024*1024||
    !["image/jpeg","image/png","image/webp"].includes(file.type)){
    throw new ApiError(400,"Upload an official JPEG, PNG, or WebP under 5 MB");
  }
  let bytes;
  try{
    const processor=sharp(Buffer.from(await file.arrayBuffer()),{limitInputPixels:20000000,animated:false});
    const meta=await processor.metadata();
    if(!["jpeg","png","webp"].includes(meta.format))throw Error("Bad image format");
    bytes=await processor.rotate().resize({width:kind==="logo"?750:kind==="leader"?900:kind==="gallery"?1600:2200,
      height:kind==="logo"?750:kind==="leader"?1100:kind==="gallery"?1200:1350,fit:"inside",withoutEnlargement:true})
      .webp({quality:83}).toBuffer();
  }catch{throw new ApiError(400,"Image cannot be processed");}
  const path=school.id+"/"+kind+"-"+crypto.randomUUID()+".webp";
  const {error}=await db.storage.from("school-branding").upload(path,bytes,{
    contentType:"image/webp",cacheControl:"3600",upsert:false
  });
  if(error)throw new ApiError(500,"School media storage is not ready");
  const {data}=db.storage.from("school-branding").getPublicUrl(path);
  await audit(db,{id:user.id},"school.brand_asset_uploaded",school.id,{kind,path});
  return Response.json({ok:true,url:data.publicUrl},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return jsonError(e)}
}

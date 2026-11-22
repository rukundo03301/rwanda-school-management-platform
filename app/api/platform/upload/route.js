import sharp from "sharp";
import { authenticate,requirePermission,validateUuid,checked,jsonError,ApiError } from "../../../../lib/platform-server.js";
export const runtime="nodejs";
export async function POST(request) {
  try{
    const {actor,db}=await authenticate(request);
    requirePermission(actor,"tenants.brand");
    const contentLength=Number(request.headers.get("content-length")||0);
    if(contentLength>6*1024*1024)throw new ApiError(413,"Image too large (maximum 5 MB).");
    const form=await request.formData();
    const schoolId=validateUuid(form.get("schoolId"),"school");
    const kind=String(form.get("kind")||"");
    if(!["logo","hero"].includes(kind))throw new ApiError(400,"Choose logo or hero image.");
    const image=form.get("image");
    if(!(image instanceof File)||!["image/jpeg","image/png","image/webp"].includes(image.type)||image.size>5*1024*1024||image.size===0)
      throw new ApiError(400,"Choose a JPEG, PNG or WebP photo under 5 MB.");
    await checked(db.from("platform_schools").select("id").eq("id",schoolId).single());
    // Decode and rewrite to strip file metadata, unusual encodings and embedded scripts.
    let processed;
    try{
      const raw=Buffer.from(await image.arrayBuffer());
      const processor=sharp(raw,{limitInputPixels:20000000,animated:false});
      const meta=await processor.metadata();
      if(!["jpeg","png","webp"].includes(meta.format))throw new Error("Unsupported image format");
      processed=await processor.rotate().resize({
        width:kind==="logo"?750:2200,
        height:kind==="logo"?750:1350,
        fit:"inside",withoutEnlargement:true
      }).webp({quality:83,effort:4}).toBuffer();
    } catch {throw new ApiError(400,"Unable to process this image. Try a different JPEG, PNG or WebP.");}
    const path=schoolId+"/"+kind+"-"+crypto.randomUUID()+".webp";
    const {error}=await db.storage.from("school-branding").upload(path,processed,{
      contentType:"image/webp",cacheControl:"3600",upsert:false
    });
    if(error)throw new ApiError(500,"Unable to store image in school branding bucket.");
    const {data}=db.storage.from("school-branding").getPublicUrl(path);
    return Response.json({url:data.publicUrl,kind},{headers:{"Cache-Control":"no-store"}});
  } catch(err){return jsonError(err);}
}

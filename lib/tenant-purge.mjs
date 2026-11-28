// All uploaded tenant files must be deleted through the official Supabase
// Storage API, never by deleting rows from storage.objects directly.
// Every path is strictly prefixed with the exact verified school UUID.
export const TENANT_DELETE_PHRASE="DELETE ALL SCHOOL DATA";
export const scopedStoragePrefixes=id=>[
 id, "schools/"+id, "tenants/"+id
];
const MAX_OBJECTS=5000,MAX_DEPTH=8;
export function validSchoolCodeConfirmation(actual,entered,phrase){
 return Boolean(actual)&&entered===actual&&phrase===TENANT_DELETE_PHRASE;
}
export async function collectTenantStoragePaths(storage,bucket,schoolId){
 const paths=new Set();
 const folders=new Set();
 const list=async(prefix,depth)=>{
  if(depth>MAX_DEPTH||folders.size>MAX_OBJECTS)
   throw Error("School storage contains too many nested folders; manual review required");
  if(folders.has(prefix))return;
  folders.add(prefix);
  let offset=0;
  while(true){
   const {data,error}=await storage.from(bucket).list(prefix,{
    limit:100,offset,sortBy:{column:"name",order:"asc"}
   });
   if(error)throw Error("Unable to list all stored school files; deletion stopped");
   if(!Array.isArray(data))throw Error("Storage inventory was incomplete");
   for(const object of data){
    if(typeof object?.name!=="string"||object.name==="."||object.name==="..")
     throw Error("Storage file inventory contains an invalid path");
    const full=prefix+"/"+object.name;
    if(object.id||object.metadata)paths.add(full);
    else await list(full,depth+1);
    if(paths.size>MAX_OBJECTS)throw Error("Too many tenant files; deletion stopped for review");
   }
   if(data.length<100)break;
   offset+=data.length;
   if(offset>MAX_OBJECTS)throw Error("Storage list exceeds safe deletion cap");
  }
 };
 for(const prefix of scopedStoragePrefixes(schoolId))await list(prefix,0);
 return [...paths].sort();
}
export async function removeTenantStorage(db,preview,schoolId){
 const buckets=preview.storage_buckets||[];
 if(!Array.isArray(buckets)||buckets.some(x=>typeof x!=="string"||!x))
  throw Error("Storage bucket inventory could not be verified");
 let removed=0;
 for(const bucket of buckets){
  const files=await collectTenantStoragePaths(db.storage,bucket,schoolId);
  for(let offset=0;offset<files.length;offset+=100){
   const part=files.slice(offset,offset+100);
   const {error}=await db.storage.from(bucket).remove(part);
   if(error)throw Error("Storage removal failed; no database records were deleted");
   removed+=part.length;
  }
 }
 return removed;
}

// Returns a safe embeddable address for YouTube links, otherwise null.
export function youtubeEmbed(url){
 try{
  const u=new URL(url);const h=u.hostname.toLowerCase().replace(/^www\.|^m\./,"");
  let id=null;
  if(h==="youtu.be")id=u.pathname.slice(1);
  else if(h==="youtube.com"){
   if(u.pathname==="/watch")id=u.searchParams.get("v");
   else if(u.pathname.startsWith("/embed/")||u.pathname.startsWith("/shorts/"))id=u.pathname.split("/")[2];
  }
  return id&&/^[\w-]{11}$/.test(id)?"https://www.youtube-nocookie.com/embed/"+id:null;
 }catch{return null;}
}

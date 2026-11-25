import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {cleanMaterialUrl,materialInput} from "../lib/school-materials.mjs";
import {youtubeEmbed} from "../lib/youtube-embed.mjs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
test("only public https links are accepted and videos must use a video site",()=>{
 assert.equal(cleanMaterialUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ","video"),"https://www.youtube.com/watch?v=dQw4w9WgXcQ");
 for(const bad of ["http://youtube.com/watch?v=a","javascript:alert(1)","https://localhost/x","https://127.0.0.1/x","https://user:pw@youtube.com/x","not a link","https://evil.example/x"]){
  assert.throws(()=>cleanMaterialUrl(bad,"video"),bad);
 }
 assert.equal(cleanMaterialUrl("https://drive.google.com/file/d/abc/view","document"),"https://drive.google.com/file/d/abc/view");
});
test("material input is trimmed and checked",()=>{
 const m=materialInput({kind:"link",title:"  Fractions  ",url:"https://example.org/page",description:" notes "});
 assert.equal(m.title,"Fractions");assert.equal(m.description,"notes");
 assert.throws(()=>materialInput({kind:"zip",title:"abc",url:"https://example.org/p"}));
 assert.throws(()=>materialInput({kind:"link",title:"a",url:"https://example.org/p"}));
});
test("only real YouTube video ids are embedded",()=>{
 assert.equal(youtubeEmbed("https://youtu.be/dQw4w9WgXcQ"),"https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
 assert.equal(youtubeEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5"),"https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
 assert.equal(youtubeEmbed("https://vimeo.com/123"),null);
 assert.equal(youtubeEmbed("https://www.youtube.com/watch?v=<script>"),null);
});
test("materials are hidden by default, private to the assigned teacher, and registered for school erasure",()=>{
 const sql=read("../database/school_learning_materials_v1.sql");
 assert.match(sql,/published boolean not null default false/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all on table public\.school_learning_materials from public,anon,authenticated/);
 assert.match(sql,/platform_tenant_scope_manifest/);
 const api=read("../app/api/school/[code]/classroom/route.js");
 assert.match(api,/eq\("teacher_id",actorId\)/);
 const learn=read("../app/api/school/[code]/learning/route.js");
 assert.match(learn,/eq\("published",true\)/);
 assert.match(learn,/eq\("class_id",activeClass\.id\)/);
});

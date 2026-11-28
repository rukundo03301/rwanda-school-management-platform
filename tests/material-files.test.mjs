import test from "node:test";
import assert from "node:assert/strict";
import {materialFileInput,sniffMatches,safeFileName,MAX_FILE_BYTES} from "../lib/material-files.mjs";

const ok={title:"Fractions study guide",fileName:"fractions.pdf",mimeType:"application/pdf",size:1200};
test("accepts the approved document and image types",()=>{
 assert.equal(materialFileInput(ok).ext,"pdf");
 assert.equal(materialFileInput({...ok,fileName:"a.docx",mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}).ext,"docx");
 assert.equal(materialFileInput({...ok,fileName:"a.pptx",mimeType:"application/vnd.openxmlformats-officedocument.presentationml.presentation"}).ext,"pptx");
 assert.equal(materialFileInput({...ok,fileName:"a.JPG",mimeType:"image/jpeg"}).ext,"jpg");
});
test("rejects scripts, mismatched types, empty and oversized files",()=>{
 assert.throws(()=>materialFileInput({...ok,fileName:"run.exe",mimeType:"application/pdf"}));
 assert.throws(()=>materialFileInput({...ok,fileName:"page.html",mimeType:"text/html"}));
 assert.throws(()=>materialFileInput({...ok,fileName:"a.pdf",mimeType:"image/png"}));
 assert.throws(()=>materialFileInput({...ok,size:0}));
 assert.throws(()=>materialFileInput({...ok,size:MAX_FILE_BYTES+1}));
 assert.throws(()=>materialFileInput({...ok,title:"ab"}));
});
test("file names lose paths and control characters",()=>{
 assert.equal(safeFileName("..\\..\\evil/notes.pdf"),"notes.pdf");
 assert.equal(safeFileName("a\u0000b.pdf"),"ab.pdf");
});
test("real file signatures are checked",()=>{
 assert.ok(sniffMatches("pdf",Buffer.from("%PDF-1.7 ...")));
 assert.ok(!sniffMatches("pdf",Buffer.from("<html>")));
 assert.ok(sniffMatches("docx",Buffer.from([0x50,0x4b,3,4,0])));
 assert.ok(!sniffMatches("png",Buffer.from([0xff,0xd8,0xff,0])));
 assert.ok(sniffMatches("jpg",Buffer.from([0xff,0xd8,0xff,0xe0])));
 assert.ok(sniffMatches("webp",Buffer.from("RIFF1234WEBPVP8 ")));
 assert.ok(!sniffMatches("webp",Buffer.from("RIFF1234WAVEfmt ")));
});

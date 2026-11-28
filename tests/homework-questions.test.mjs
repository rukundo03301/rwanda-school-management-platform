import test from "node:test";
import assert from "node:assert/strict";
import {normalizeQuestions,autoMark,cleanAnswers,publicQuestion,parseNumber} from "../lib/homework-questions.mjs";
test("normalizes every question type and rejects incomplete ones",()=>{
 const q=normalizeQuestions([
  {kind:"single",prompt:"2+2?",options:["3","4"],correct:1,marks:1},
  {kind:"multi",prompt:"Primes",options:["2","3","4"],correct:[0,1],marks:2},
  {kind:"truefalse",prompt:"9=3²",correct:true,marks:1},
  {kind:"numeric",prompt:"√16",correct:"4",tolerance:"0.1",marks:2},
  {kind:"short",prompt:"Capital?",correct:"Kigali\nkigali city",marks:1},
  {kind:"essay",prompt:"Describe",marks:5}]);
 assert.equal(q.length,6);assert.equal(q[5].answer_key,null);
 assert.throws(()=>normalizeQuestions([{kind:"single",prompt:"x",options:["a","b"],marks:1}]));
 assert.throws(()=>normalizeQuestions([]));
 assert.throws(()=>normalizeQuestions([{kind:"numeric",prompt:"x",correct:"abc",marks:1}]));
});
test("auto-marks only where a reliable key exists",()=>{
 const base=(o)=>({marks:2,tolerance:0,options:[],...o});
 assert.equal(autoMark(base({kind:"single",answer_key:{index:1}}),1),2);
 assert.equal(autoMark(base({kind:"single",answer_key:{index:1}}),0),0);
 assert.equal(autoMark(base({kind:"multi",answer_key:{indexes:[0,2]}}),[2,0]),2);
 assert.equal(autoMark(base({kind:"multi",answer_key:{indexes:[0,2]}}),[0]),0);
 assert.equal(autoMark(base({kind:"truefalse",answer_key:{value:false}}),"false"),2);
 assert.equal(autoMark(base({kind:"numeric",answer_key:{value:4},tolerance:0.1}),"4,05"),2);
 assert.equal(autoMark(base({kind:"numeric",answer_key:{value:4}}),"5"),0);
 assert.equal(autoMark(base({kind:"short",answer_key:{accepted:["Kigali"]}}),"  kigali "),2);
 assert.equal(autoMark(base({kind:"short",answer_key:null}),"x"),null);
 assert.equal(autoMark(base({kind:"essay",answer_key:null}),"long"),null);
 assert.equal(autoMark(base({kind:"single",answer_key:{index:1}}),undefined),0);
});
test("student answers are cleaned and answer keys never leave the server",()=>{
 const qs=[{id:"a",kind:"single",options:["x","y"]},{id:"b",kind:"multi",options:["x","y"]},{id:"c",kind:"numeric",options:[]}];
 assert.deepEqual(cleanAnswers(qs,{a:5,b:[1,1,9],c:"3",zz:"hack"}),{b:[1],c:"3"});
 const pq=publicQuestion({id:"a",position:1,kind:"single",prompt:"p",options:["x","y"],marks:"1.00",answer_key:{index:0},tolerance:0});
 assert.equal("answer_key" in pq,false);
 assert.equal(parseNumber("1 000,5"),1000.5);
});

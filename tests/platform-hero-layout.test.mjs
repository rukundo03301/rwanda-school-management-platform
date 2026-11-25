import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const landing=readFileSync(new URL("../app/platform/Landing.jsx",import.meta.url),"utf8");
const page=readFileSync(new URL("../app/platform/page.jsx",import.meta.url),"utf8");

test("Umurage welcome image stays fully visible without background cover cropping",()=>{
 assert.match(landing,/className="lp-hero-image"/);
 assert.match(landing,/object-fit:contain/);
 assert.match(landing,/width="1536"[\s\S]*height="1152"/);
 assert.doesNotMatch(landing,/background-size:cover|object-fit:cover/);
 assert.match(landing,/width:100%;[\s\S]*height:auto/);
});

test("platform authentication stays a separate lower card with reachable sign-in link",()=>{
 assert.match(landing,/\.shell\.lp\s*>\s*\.auth-card/);
 assert.match(landing,/href="#platform-sign-in"/);
 assert.match(page,/className="auth-card" id="platform-sign-in"/);
 assert.match(landing,/align-self:flex-end/);
});

test("mobile and narrow screens keep login card below the full image",()=>{
 assert.match(landing,/@media\(max-width:760px\)/);
 assert.match(landing,/\.shell\.lp\s*>\s*\.auth-card\s*\{[\s\S]*align-self:center/);
 assert.match(landing,/max-width:100%/);
 assert.match(landing,/overflow-x:clip/);
});

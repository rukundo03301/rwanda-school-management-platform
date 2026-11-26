import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const landing=readFileSync(new URL("../app/platform/Landing.jsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../app/platform/landing.css",import.meta.url),"utf8");
const page=readFileSync(new URL("../app/platform/page.jsx",import.meta.url),"utf8");

test("approved user-supplied original replaces cartoon vector implementation",()=>{
 assert.match(landing,/src="\/umurage-approved-hero\.webp"/);
 assert.match(landing,/width="1672"/);
 assert.match(landing,/height="941"/);
 assert.match(css,/aspect-ratio:1672\/941/);
 assert.match(css,/height:auto/);
 assert.doesNotMatch(css,/object-fit:fill/);
 assert.doesNotMatch(landing,/FamilyStage|lp-stage-illustration|className="lp-card"/);
 assert.ok(existsSync(new URL("../public/umurage-approved-hero.webp",import.meta.url)));
});
test("illustrated login and signup areas are clickable without duplicating artwork",()=>{
 assert.match(landing,/className="lp-desktop-auth"/);
 assert.match(landing,/className="lp-art-login" onClick=\{onLogin\}/);
 assert.match(landing,/className="lp-art-signup" onClick=\{onSignup\}/);
 assert.match(css,/pointer-events:none/);
 assert.match(css,/pointer-events:auto/);
 assert.match(page,/onLogin=\{\(\)=>openAuth\("login"\)\}/);
 assert.match(page,/onSignup=\{\(\)=>openAuth\("signup"\)\}/);
 assert.match(page,/aria-modal="true"/);
 assert.match(page,/signInWithPassword/);
 assert.match(page,/auth\.signUp/);
});
test("mobile receives accessible real controls with no stretched photo",()=>{
 assert.match(css,/@media\(max-width:820px\)/);
 assert.match(css,/\.lp-mobile-bar/);
 assert.match(landing,/aria-label="Platform account"/);
 assert.match(css,/overflow-x:clip/);
 assert.match(css,/max-width:100%/);
});

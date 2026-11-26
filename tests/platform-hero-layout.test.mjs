import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const landing=readFileSync(new URL("../app/platform/Landing.jsx",import.meta.url),"utf8");
const platform=readFileSync(new URL("../app/platform/page.jsx",import.meta.url),"utf8");

test("Umurage uses the exact uploaded image to fill the single-screen homepage",()=>{
 assert.match(landing,/height:100dvh/);
 assert.match(landing,/overflow:hidden/);
 assert.match(landing,/className="lp-hero-image"/);
 assert.match(landing,/src="\/umurage-hero-original\.webp"/);
 assert.match(landing,/width="1269"[\s\S]*height="952"/);
 assert.match(landing,/object-fit:cover/);
 assert.match(landing,/object-position:center center/);
 assert.match(landing,/inset:0/);
 assert.doesNotMatch(landing,/object-fit:contain|lp-hero-backdrop|filter:blur\(22px\)/);
 assert.doesNotMatch(landing,/lp-below|href="#platform-sign-in"/);
});

test("login and signup remain in the top-right header and open the existing authentication dialog",()=>{
 assert.match(landing,/className="lp-topbar"/);
 assert.match(landing,/className="lp-auth-nav"/);
 assert.match(landing,/onClick=\{onLogin\}>Log In/);
 assert.match(landing,/onClick=\{onSignup\}>Sign Up/);
 assert.match(platform,/onLogin=\{\(\)=>openAuth\("login"\)\}/);
 assert.match(platform,/onSignup=\{\(\)=>openAuth\("signup"\)\}/);
 assert.match(platform,/\{authOpen&&<div className="lp-auth-overlay"/);
 assert.match(platform,/aria-modal="true"/);
 assert.match(platform,/className="lp-auth-close"/);
 assert.match(platform,/signInWithPassword/);
 assert.match(platform,/auth\.signUp/);
});

test("auth overlay stays on this page and adapts to narrow screens",()=>{
 assert.match(landing,/@media\(max-width:620px\)/);
 assert.match(landing,/\.shell\.lp\s*\.lp-auth-overlay/);
 assert.match(landing,/max-height:calc\(100dvh - var\(--lp-header-height\) - 20px\)/);
 assert.match(platform,/setAuthOpen\(false\)/);
 assert.doesNotMatch(platform,/href="#platform-sign-in"/);
});

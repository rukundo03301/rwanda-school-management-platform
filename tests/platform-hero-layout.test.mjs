import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";

const landing=readFileSync(new URL("../app/platform/Landing.jsx",import.meta.url),"utf8");
const styles=readFileSync(new URL("../app/platform/landing.css",import.meta.url),"utf8");
const platform=readFileSync(new URL("../app/platform/page.jsx",import.meta.url),"utf8");
const publicBase=new URL("../public/",import.meta.url);

test("Umurage landing uses responsive code-built cards, not an image backdrop",()=>{
 assert.match(landing,/import "\.\/landing\.css"/);
 assert.match(landing,/function FamilyStage\(\)/);
 assert.match(landing,/className="lp-composition"/);
 assert.match(landing,/className="lp-stage-illustration"/);
 assert.match(landing,/className="lp-stage-labels"/);
 assert.match(landing,/className="lp-level-grid"/);
 assert.match(landing,/className="lp-bottom-grid"/);
 assert.doesNotMatch(landing,/umurage-hero|<img\b|objectFit|backgroundImage|imageFailed/);
 assert.doesNotMatch(styles,/background-image\s*:|object-fit\s*:|\.lp-hero-image/);
 assert.ok(!existsSync(new URL("umurage-hero.jpg",publicBase)));
 assert.ok(!existsSync(new URL("umurage-hero-original.webp",publicBase)));
});

test("all education levels and connected school user roles are represented",()=>{
 for(const level of ["Nursery","Primary","Secondary / High School","College / University"])
  assert.ok(landing.includes(level),level);
 for(const role of ["Students","Teachers","Parents","School leaders","Finance & reports"])
  assert.ok(landing.includes(role),role);
 for(const feature of ["Academic Progress","Announcements","School Information","Attendance","Fees & Payments","Messages & Communication","Reports & Analytics"])
  assert.ok(landing.includes(feature),feature);
 assert.match(landing,/Smart Learning Starts Here/);
 assert.match(landing,/illustrate platform capabilities, not personal school records/);
});

test("responsive and accessible top-right authentication is unchanged",()=>{
 assert.match(styles,/@media\(max-width:1000px\)/);
 assert.match(styles,/@media\(max-width:730px\)/);
 assert.match(styles,/@media\(max-width:560px\)/);
 assert.match(styles,/@media\(max-width:380px\)/);
 assert.match(styles,/min-height:100dvh/);
 assert.match(styles,/overflow-x:clip/);
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

test("public marketing content does not claim fictional figures are real attendance, fees, or grades",()=>{
 assert.doesNotMatch(landing,/RWF\s*[\d,]+|2024\s*[-–]\s*2025|>[0-9]{1,3}%</);
 assert.match(landing,/Illustrative calendar/);
});

"use client";
import "./landing.css";

/**
 * Use the approved Umurage illustration exactly as supplied.
 * Its original typography, raised family stage and glossy connected panels
 * are part of the image; code only supplies responsive layout and working auth.
 */
export default function Landing({onLogin,onSignup}){
 return <section className="lp-home" aria-label="Umurage School Management Platform homepage">
  <div className="lp-mobile-bar">
   <div className="lp-mobile-brand">
    <strong>UMURAGE</strong>
    <small>Smart Learning Starts Here</small>
   </div>
   <nav className="lp-mobile-auth" aria-label="Platform account">
    <button type="button" onClick={onLogin}>Log In</button>
    <button type="button" className="lp-mobile-signup" onClick={onSignup}>Sign Up</button>
   </nav>
  </div>
  <div className="lp-art-wrap">
   <img
    className="lp-approved-art"
    src="/umurage-approved-hero.webp"
    alt="Umurage School Management Platform: Smart Learning Starts Here. A multigenerational African family on an elevated illuminated sofa stage connected to nursery, primary, high school and university campuses, school administration, students, teachers, parents, academic progress, fees, messages, announcements and attendance."
    width="1672"
    height="941"
    decoding="async"
    fetchPriority="high"
   />
   <nav className="lp-desktop-auth" aria-label="Platform account">
    <button type="button" className="lp-art-login" onClick={onLogin} aria-label="Log In"><span>Log In</span></button>
    <button type="button" className="lp-art-signup" onClick={onSignup} aria-label="Sign Up"><span>Sign Up</span></button>
   </nav>
  </div>
 </section>;
}

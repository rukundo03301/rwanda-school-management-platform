// Source-verified primary assessment reference, not the complete REB syllabus.
// NESA: 2025–2026 End-of-Term II Assessment Standards, Primary P1–P6,
// pages 5–7. Grade applicability and subject names as listed in those standards.
// Source: https://www.nesa.gov.rw/fileadmin/user_upload/NESA/Ressources/Assessment_Standards_and_Guidelines/2025-2026_End_of_Term_II_Assessment_Standards_P1_-_S6_GE_PE_TSS/Primary_AS_Term_II_2025-2026_Signed.pdf
// Paper maxima can differ from CA-MIS marks; do not use paper totals as
// curriculum maxima. Schools must verify the standards applicable to each year.

export const NESA_PRIMARY_REFERENCE=Object.freeze({
 version:"2025–2026 Term II",
 authority:"NESA",
 document:"Primary P1–P6 End-of-Term II Assessment Standards",
 sourceUrl:"https://www.nesa.gov.rw/fileadmin/user_upload/NESA/Ressources/Assessment_Standards_and_Guidelines/2025-2026_End_of_Term_II_Assessment_Standards_P1_-_S6_GE_PE_TSS/Primary_AS_Term_II_2025-2026_Signed.pdf",
 sourceKind:"assessment_standards_not_full_curriculum",
 lowerPrimary: Object.freeze([
  {subject:"Creative Arts",paperMax:20,camisMax:20},
  {subject:"English",paperMax:40,camisMax:50},
  {subject:"French",paperMax:20,camisMax:20},
  {subject:"Kinyarwanda / Rwanda Sign Language (LEGRA)",paperMax:50,camisMax:50,special:"LEGRA separate assessment"},
  {subject:"Mathematics",paperMax:40,camisMax:50},
  {subject:"Physical Education and Sports",paperMax:10,camisMax:10},
  {subject:"Science and Elementary Technology",paperMax:40,camisMax:20},
  {subject:"Social Studies and Religious Education",paperMax:40,camisMax:20}
 ]),
 upperPrimary:Object.freeze([
  {subject:"Creative Arts",paperMax:20,camisMax:20},
  {subject:"English",paperMax:50,camisMax:90},
  {subject:"French",paperMax:50,camisMax:50},
  {subject:"Kinyarwanda / Rwanda Sign Language",paperMax:50,camisMax:90},
  {subject:"Mathematics",paperMax:50,camisMax:90},
  {subject:"Physical Education and Sports",paperMax:20,camisMax:20},
  {subject:"Science and Elementary Technology",paperMax:50,camisMax:50},
  {subject:"Social Studies and Religious Education",paperMax:50,camisMax:50}
 ])
});
export function primaryReferenceForGrade(grade){
 if(!/^(P[1-6])$/.test(grade||""))return [];
 return Number(grade[1])<=3?NESA_PRIMARY_REFERENCE.lowerPrimary:NESA_PRIMARY_REFERENCE.upperPrimary;
}

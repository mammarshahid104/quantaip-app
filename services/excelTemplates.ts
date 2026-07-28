// Excel template columns — deliberately minimal, one flat sheet per entity.
//   Students → Full Name | Class | Section | Roll No. | Father Name | Parents Phone
//   Teachers → Full Name | Subject | Class Assigned | Phone No.
//
// These MUST stay byte-identical to quantaip-web's src/services/excelExport.js
// so a sheet exported from the web dashboard imports cleanly here, and vice versa.

export const STUDENT_COLUMNS = [
  'Full Name',
  'Class',
  'Section',
  'Roll No.',
  'Father Name',
  'Parents Phone',
];

export const TEACHER_COLUMNS = [
  'Full Name',
  'Subject',
  'Class Assigned',
  'Phone No.',
];

// Example rows shipped inside the downloadable templates.
export const STUDENT_EXAMPLE_ROW = [
  'Ahmed Ali',
  'Grade 10',
  'A',
  '001',
  'Muhammad Ali',
  '0300-1234567',
];

export const TEACHER_EXAMPLE_ROW = [
  'Ms. Ayesha',
  'Physics',
  'Grade 10, Grade 11',
  '0300-1111111',
];

// First non-empty value among the accepted header spellings. Older exports used
// slightly different headers ("Name", "Roll No", "Phone"), so keep reading those.
export function pickCol(row: any, ...headers: string[]): string {
  for (const h of headers) {
    const v = row[h];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return String(v).trim();
    }
  }
  return '';
}

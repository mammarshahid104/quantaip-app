import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Linking,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import Share from 'react-native-share';
import RNFS from 'react-native-fs';
import {captureRef} from 'react-native-view-shot';
import {
  ClipboardDocumentCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowRightOnRectangleIcon,
  BookOpenIcon,
  UserGroupIcon,
  PencilSquareIcon,
  AcademicCapIcon,
  ChartBarIcon,
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
} from 'react-native-heroicons/outline';

import {getSchoolCode} from '../config';
import {theme} from '../theme';

const TEST_TYPES = [
  {key: 'weekly', label: 'Weekly Test'},
  {key: 'monthly', label: 'Monthly Test'},
  {key: 'midterm', label: 'Mid Term'},
  {key: 'sendup', label: 'Send Up'},
  {key: 'final', label: 'Final Exam'},
  {key: 'classtest', label: 'Class Test'},
];

export default function TeacherScreen({navigation}: any) {
  const [teacher, setTeacher] = useState<any>(null);
  const [classes, setClasses] = useState<string[]>([]);
  const [inchargeClasses, setInchargeClasses] = useState<string[]>([]);
  const [tab, setTab] = useState('My Classes');

  // Timetable states
  const [ttClass, setTtClass] = useState('');
  const [ttData, setTtData] = useState<any>(null);
  const [loadingTT, setLoadingTT] = useState(false);
  const todayName = new Date().toLocaleDateString('en-US', {weekday: 'long'});
  const [ttDay, setTtDay] = useState(todayName === 'Sunday' ? 'Monday' : todayName);

  const loadTeacherTimetable = async (cls: string) => {
    setTtClass(cls);
    setLoadingTT(true);
    try {
      const doc = await firestore()
        .collection('schools').doc(getSchoolCode())
        .collection('timetable').doc(cls)
        .get();
      const data = doc.data();
      setTtData(data && data.Monday ? data : null);
    } catch (e) {
      console.log('❌ QUANTAIP Error:', e);
      setTtData(null);
    } finally {
      setLoadingTT(false);
    }
  };

  // ============ HOMEWORK ============
  const tomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  const [hwClass, setHwClass] = useState('');
  const [hwSubject, setHwSubject] = useState('');
  const [hwTitle, setHwTitle] = useState('');
  const [hwDesc, setHwDesc] = useState('');
  const [hwDue, setHwDue] = useState(tomorrow());
  const [hwList, setHwList] = useState<any[]>([]);
  const [loadingHW, setLoadingHW] = useState(false);
  const [assigningHW, setAssigningHW] = useState(false);

  const loadHomework = async (cls: string) => {
    setHwClass(cls);
    setLoadingHW(true);
    try {
      const doc = await firestore()
        .collection('schools').doc(getSchoolCode())
        .collection('homework').doc(cls)
        .get();
      setHwList(doc.data()?.items || []);
    } catch (e) {
      console.log('❌ QUANTAIP Error:', e);
      setHwList([]);
    } finally {
      setLoadingHW(false);
    }
  };

  const assignHomework = async () => {
    if (!hwClass || !hwSubject.trim() || !hwTitle.trim()) {
      Alert.alert('Missing Information', 'Please select a class and enter subject and title.');
      return;
    }
    setAssigningHW(true);
    try {
      const newItem = {
        subject: hwSubject.trim(),
        title: hwTitle.trim(),
        description: hwDesc.trim(),
        dueDate: hwDue.trim(),
        teacherName: teacher?.name || '',
        assignedDate: new Date().toISOString().split('T')[0],
      };
      // Naya item sab se upar, sirf aakhri 50 rakho (doc halka rahe)
      const updated = [newItem, ...hwList].slice(0, 50);
      await firestore()
        .collection('schools').doc(getSchoolCode())
        .collection('homework').doc(hwClass)
        .set({items: updated});
      setHwList(updated);
      setHwSubject(''); setHwTitle(''); setHwDesc(''); setHwDue(tomorrow());
      Alert.alert('Homework Assigned ✅', `Homework assigned to ${hwClass}.`);
    } catch (e) {
      console.log('❌ QUANTAIP Error:', e);
      Alert.alert('Error', 'Could not assign homework. Please try again.');
    } finally {
      setAssigningHW(false);
    }
  };

  // ============ DAILY DIARY ============
  const todayKey = () => new Date().toISOString().split('T')[0];

  const [diaryClass, setDiaryClass] = useState('');
  const [diaryDate, setDiaryDate] = useState(todayKey());
  const [diaryRows, setDiaryRows] = useState<{subject: string; task: string}[]>([]);
  const [diaryGenerated, setDiaryGenerated] = useState(false);
  const [generatingDiary, setGeneratingDiary] = useState(false);
  const [sharingDiary, setSharingDiary] = useState(false);

  const dayNameOf = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return isNaN(d.getTime())
      ? ''
      : d.toLocaleDateString('en-US', {weekday: 'long'});
  };

  const prettyDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return isNaN(d.getTime())
      ? dateStr
      : d.toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'});
  };

  const fetchSchoolName = async () => {
    try {
      const doc = await firestore()
        .collection('schools').doc(getSchoolCode())
        .collection('settings').doc('profile')
        .get();
      return doc.data()?.schoolName || 'School';
    } catch (e) {
      return 'School';
    }
  };

  const generateDiary = async () => {
    if (!diaryClass) {
      Alert.alert('Select Class', 'Please select a class for the diary.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(diaryDate) || isNaN(new Date(diaryDate + 'T00:00:00').getTime())) {
      Alert.alert('Invalid Date', 'Please enter the date as YYYY-MM-DD.');
      return;
    }
    setGeneratingDiary(true);
    setDiaryGenerated(false);
    const schoolCode = getSchoolCode();
    console.log('📄 Diary → school:', schoolCode, '| class:', diaryClass, '| date:', diaryDate);
    try {
      // Subjects come from this class's homework doc only — teachers can't read
      // other teachers' docs (Firestore rules), so we never touch that collection.
      console.log('📄 Diary → fetching homework for', diaryClass);
      const hwDoc = await firestore()
        .collection('schools').doc(schoolCode)
        .collection('homework').doc(diaryClass)
        .get();
      const items: any[] = hwDoc.data()?.items || [];
      console.log('📄 Diary → homework items:', items.length);

      // Unique subjects taught in THIS class (derived from its homework)
      const subjects: string[] = [];
      const taskMap: {[subject: string]: string} = {};
      items
        .filter(it => it.assignedDate === diaryDate)
        .forEach(it => {
          if (!it.subject) {
            return;
          }
          if (!subjects.includes(it.subject)) {
            subjects.push(it.subject);
          }
          const task = [it.title, it.description].filter(Boolean).join(' — ');
          taskMap[it.subject] = taskMap[it.subject]
            ? `${taskMap[it.subject]}; ${task}`
            : task;
        });

      const rows = subjects
        .sort((a, b) => a.localeCompare(b))
        .map(subject => ({subject, task: taskMap[subject] || ''}));
      console.log('📄 Diary → rows built:', rows.length);

      if (rows.length === 0) {
        Alert.alert(
          'Nothing to Show',
          'No homework found for this class on the selected date. Add homework first.',
        );
        setGeneratingDiary(false);
        return;
      }

      setDiaryRows(rows);
      setDiaryGenerated(true);
      console.log('📄 Diary → generated ✅');
    } catch (e: any) {
      console.log('❌ Diary generation failed →', e?.code, e?.message, e);
      Alert.alert('Error', `Could not generate diary. ${e?.message || 'Please try again.'}`);
    } finally {
      setGeneratingDiary(false);
    }
  };

  const buildDiaryText = (schoolName: string) => {
    const lines = [
      schoolName,
      'Daily Diary',
      `Date: ${prettyDate(diaryDate)}   Day: ${dayNameOf(diaryDate)}   Grade: ${diaryClass}`,
      '',
    ];
    diaryRows.forEach(r => {
      lines.push(`• ${r.subject}: ${r.task || '—'}`);
    });
    return lines.join('\n');
  };

  const buildDiaryHTML = (schoolName: string) => {
    const esc = (s: string) =>
      (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const rowsHtml = diaryRows
      .map(
        r => `<tr><td class="subj">${esc(r.subject)}</td><td>${esc(r.task) || '&nbsp;'}</td></tr>`,
      )
      .join('');
    return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  body { font-family: Helvetica, Arial, sans-serif; color: #0d1f3c; padding: 24px; }
  .school { text-align: center; font-size: 22px; font-weight: 700; color: #0d1f3c; }
  .title { text-align: center; font-size: 16px; font-weight: 700; color: #B8960A; letter-spacing: 3px; margin: 4px 0 14px; }
  .meta { text-align: center; font-size: 13px; color: #4a3728; margin-bottom: 18px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #e8d5a3; padding: 10px 12px; font-size: 13px; text-align: left; vertical-align: top; }
  th { background: #0d1f3c; color: #C9A84C; font-weight: 700; }
  td.subj { width: 32%; font-weight: 600; background: #fdf8ee; }
</style></head><body>
  <div class="school">${esc(schoolName)}</div>
  <div class="title">DAILY DIARY</div>
  <div class="meta">Date: ${esc(prettyDate(diaryDate))} &nbsp; | &nbsp; Day: ${esc(dayNameOf(diaryDate))} &nbsp; | &nbsp; Grade: ${esc(diaryClass)}</div>
  <table>
    <thead><tr><th>Subject</th><th>Daily Tasks</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body></html>`;
  };

  const shareDiaryText = async () => {
    setSharingDiary(true);
    try {
      const schoolName = await fetchSchoolName();
      await Share.open({
        title: 'Daily Diary',
        message: buildDiaryText(schoolName),
        failOnCancel: false,
      });
    } catch (e: any) {
      if (e?.message && !/cancel/i.test(e.message)) {
        Alert.alert('Share Error', e.message);
      }
    } finally {
      setSharingDiary(false);
    }
  };

  const shareDiaryAsHTML = async () => {
    setSharingDiary(true);
    try {
      const schoolName = await fetchSchoolName();
      const html = buildDiaryHTML(schoolName);
      const safeName = `Daily_Diary_${diaryClass.replace(/\s+/g, '_')}_${diaryDate}.html`;
      const path = `${RNFS.CachesDirectoryPath}/${safeName}`;
      await RNFS.writeFile(path, html, 'utf8');
      await Share.open({
        title: 'Daily Diary',
        subject: `Daily Diary — ${diaryClass} — ${prettyDate(diaryDate)}`,
        url: `file://${path}`,
        type: 'text/html',
        filename: safeName,
        failOnCancel: false,
      });
    } catch (e: any) {
      if (e?.message && !/cancel/i.test(e.message)) {
        Alert.alert('Share Error', e.message);
      }
    } finally {
      setSharingDiary(false);
    }
  };

  // Attendance states
  const [selectedAttClass, setSelectedAttClass] = useState('');
  const [attStudents, setAttStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<{[key: string]: string}>({});
  const [loadingAtt, setLoadingAtt] = useState(false);
  const [submittingAtt, setSubmittingAtt] = useState(false);
  const [attSubmitted, setAttSubmitted] = useState(false);
  const [absentAlert, setAbsentAlert] = useState<any>(null);
  const [schoolName, setSchoolName] = useState('School');

  // Marks states
  const [marksStep, setMarksStep] = useState(1);
  const [testType, setTestType] = useState('');
  const [totalMarks, setTotalMarks] = useState('');
  const [selectedMarksClass, setSelectedMarksClass] = useState('');
  const [marksStudents, setMarksStudents] = useState<any[]>([]);
  const [marks, setMarks] = useState<{[key: string]: string}>({});
  // Students marked absent for this test — saved as isAbsent instead of a 0,
  // so "didn't sit the test" never looks like "scored zero".
  const [absentMarks, setAbsentMarks] = useState<{[key: string]: boolean}>({});
  const [loadingMarks, setLoadingMarks] = useState(false);
  const [submittingMarks, setSubmittingMarks] = useState(false);

  // Progress states — class → subject → student → chart + teacher's note
  const [progClass, setProgClass] = useState('');
  const [progSubject, setProgSubject] = useState('');
  const [progSubjects, setProgSubjects] = useState<string[]>([]);
  const [loadingProgSubjects, setLoadingProgSubjects] = useState(false);
  const [progStudents, setProgStudents] = useState<any[]>([]);
  const [loadingProgStudents, setLoadingProgStudents] = useState(false);
  const [progStudent, setProgStudent] = useState<any>(null);
  const [showClassReport, setShowClassReport] = useState(false);
  const [sharingReport, setSharingReport] = useState(false);
  const reportRef = useRef<any>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  useEffect(() => {
    loadTeacher();
    fetchSchoolName().then(setSchoolName);
  }, []);

  const loadTeacher = async () => {
    try {
      const user = auth().currentUser;
      if (!user) return;
      const id = user.email?.split('@')[0].toUpperCase();

      const doc = await firestore()
        .collection('schools').doc(getSchoolCode())
        .collection('teachers').doc(id)
        .get();

      const teacherData = doc.data();
      if (teacherData) {
        setTeacher(teacherData);
        setClasses(teacherData?.classesAssigned || []);

        // Check incharge classes
        const classesSnap = await firestore()
          .collection('schools').doc(getSchoolCode())
          .collection('classes').get();

        const myInchargeClasses: string[] = [];
        classesSnap.docs.forEach(d => {
          if (d.data().classIncharge === id) {
            myInchargeClasses.push(d.id);
          }
        });
        setInchargeClasses(myInchargeClasses);
      }
    } catch (e) {console.log('❌ QUANTAIP Error:', e);}
  };

  // ── ATTENDANCE ──
  const loadAttStudents = async (cls: string) => {
    setSelectedAttClass(cls);
    setAttendance({});
    setAttSubmitted(false);
    setLoadingAtt(true);
    try {
      const snapshot = await firestore()
        .collection('schools').doc(getSchoolCode())
        .collection('students')
        .where('class', '==', cls)
        .get();
      setAttStudents(snapshot.docs.map(d => d.data()));
    } catch (e) {
      setAttStudents([]);
    } finally {
      setLoadingAtt(false);
    }
  };

  const markAllPresent = () => {
    const newAttendance: {[key: string]: string} = {};
    attStudents.forEach(s => { newAttendance[s.id] = 'P'; });
    setAttendance(newAttendance);
    Alert.alert('Done', 'All students marked Present. Tap individual students to change if needed.');
  };

  const markAllAbsent = () => {
    const newAttendance: {[key: string]: string} = {};
    attStudents.forEach(s => { newAttendance[s.id] = 'A'; });
    setAttendance(newAttendance);
    Alert.alert('Done', `${attStudents.length} students marked Absent. Submit to save, then send WhatsApp alerts individually if needed.`);
  };

  const submitAttendance = async () => {
    const unmarked = attStudents.filter(s => !attendance[s.id]);
    if (unmarked.length > 0) {
      Alert.alert('Incomplete', `${unmarked.length} students not marked!`);
      return;
    }
    setSubmittingAtt(true);
    try {
      const dateKey = new Date().toISOString().split('T')[0];
      const batch = firestore().batch();
      attStudents.forEach(s => {
        const ref = firestore()
          .collection('schools').doc(getSchoolCode())
          .collection('attendance').doc(dateKey)
          .collection(selectedAttClass).doc(s.id);
          batch.set(ref, {
          studentId: s.id,
          name: s.fullName || s.name,
          status: attendance[s.id],
          class: selectedAttClass,
          date: dateKey,
          markedBy: teacher?.id,
          markedAt: firestore.FieldValue.serverTimestamp(),
        });
        // DUAL-WRITE: student ke apne doc mein bhi attendance save karo
        // taake StudentScreen/ParentScreen sirf 1 read mein sab le sakein
        const studentRef = firestore()
          .collection('schools').doc(getSchoolCode())
          .collection('students').doc(s.id);
        batch.set(studentRef, {
          attendanceMap: {[dateKey]: attendance[s.id]},
        }, {merge: true});
      });
      await batch.commit();
      setAttSubmitted(true);
      Alert.alert('Submitted ✅', `Attendance saved!`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmittingAtt(false);
    }
  };

  // ── ABSENT WHATSAPP ALERT ──
  const sendAbsentWhatsApp = async (s: any) => {
    const parentPhone = (s?.parentPhone || '').toString().trim();
    if (!parentPhone) {
      Alert.alert('No Number', 'No parent number saved for this student.');
      return;
    }
    const studentName = s.fullName || s.name || 'Student';
    const className = s.class || selectedAttClass;
    const rollNo = s.rollNo || s.id || '—';
    const date = new Date().toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    });

    const message =
`Assalam o Alaikum,

آپ کو مطلع کیا جاتا ہے کہ آپ کے بچے *${studentName}* آج *${date}* کو اسکول نہیں آئے۔

📚 Class: ${className}
📋 Roll No: ${rollNo}

براہ کرم اسکول سے رابطہ کریں۔

— ${schoolName}
QUANTAIP EduOS`;

    const phone = parentPhone.replace(/[^0-9]/g, '');
    const intlPhone = phone.startsWith('0') ? '92' + phone.slice(1) : phone;
    const url = `https://wa.me/${intlPhone}?text=${encodeURIComponent(message)}`;

    try {
      await Linking.openURL(url);
    } catch (e: any) {
      Alert.alert('WhatsApp Error', 'Could not open WhatsApp. Please make sure it is installed.');
    }
    setAbsentAlert(null);
  };

  // ── MARKS ──
  const loadMarksStudents = async (cls: string) => {
    setSelectedMarksClass(cls);
    setMarks({});
    setAbsentMarks({});
    setLoadingMarks(true);
    try {
      const snapshot = await firestore()
        .collection('schools').doc(getSchoolCode())
        .collection('students')
        .where('class', '==', cls)
        .get();
      setMarksStudents(snapshot.docs.map(d => d.data()));
      setMarksStep(3);
    } catch (e) {
      setMarksStudents([]);
    } finally {
      setLoadingMarks(false);
    }
  };

  const submitMarks = async () => {
    if (!testType || !totalMarks || !selectedMarksClass) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    // Absent students don't need a number — everyone else does.
    const unmarked = marksStudents.filter(
      s => !absentMarks[s.id] && (marks[s.id] === undefined || marks[s.id] === ''),
    );
    if (unmarked.length > 0) {
      Alert.alert('Incomplete', `${unmarked.length} students have no marks entered!`);
      return;
    }
    setSubmittingMarks(true);
    try {
      const dateKey = new Date().toISOString().split('T')[0];
      const testId = `${testType}_${selectedMarksClass.replace(/\s+/g, '')}_${teacher?.subject?.replace(/\s+/g, '')}_${dateKey}`;
      const total = parseInt(totalMarks);

      const batch = firestore().batch();

      // Save test info
      const testRef = firestore()
        .collection('schools').doc(getSchoolCode())
        .collection('marks').doc(testId);

      batch.set(testRef, {
        id: testId,
        type: testType,
        typeName: TEST_TYPES.find(t => t.key === testType)?.label,
        subject: teacher?.subject,
        totalMarks: total,
        class: selectedMarksClass,
        date: dateKey,
        markedBy: teacher?.id,
        markedByName: teacher?.name,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      // Save each student's marks
      marksStudents.forEach(s => {
        // Absent → obtained/percentage stay null and the grade is "AB", so
        // nothing downstream mistakes a missed test for a zero.
        const isAbsent = !!absentMarks[s.id];
        const obtainedRaw = marks[s.id] || '0';
        const parsed = isNaN(parseInt(obtainedRaw)) ? 0 : parseInt(obtainedRaw);
        const obtained = isAbsent ? null : parsed;
        const percentage = isAbsent ? null : Math.round((parsed / total) * 100);
        const grade = isAbsent ? 'AB' :
          percentage! >= 90 ? 'A+' : percentage! >= 80 ? 'A' :
          percentage! >= 70 ? 'B+' : percentage! >= 60 ? 'B' :
          percentage! >= 50 ? 'C' : 'F';

        const ref = firestore()
        .collection('schools').doc(getSchoolCode())
        .collection('marks').doc(testId)
        .collection('students').doc(s.id);
        batch.set(ref, {
          studentId: s.id,
          name: s.fullName || s.name,
          obtained,
          total,
          isAbsent,
          percentage,
          grade,
          class: selectedMarksClass,
          subject: teacher?.subject,
          testType,
          date: dateKey,
        });
        // DUAL-WRITE: student ke apne doc mein bhi marks save karo
        // taake Student/Parent portal sirf 1 read mein sab marks le sakein
        const studentRef = firestore()
          .collection('schools').doc(getSchoolCode())
          .collection('students').doc(s.id);
        batch.set(studentRef, {
          marksMap: {[testId]: {
            testId,
            typeName: TEST_TYPES.find(t => t.key === testType)?.label,
            testType,
            subject: teacher?.subject,
            obtained,
            total,
            isAbsent,
            percentage,
            grade,
            class: selectedMarksClass,
            date: dateKey,
          }},
        }, {merge: true});
      });

      await batch.commit();

      Alert.alert('Marks Saved ✅',
        `${TEST_TYPES.find(t => t.key === testType)?.label} marks saved for ${selectedMarksClass}!`);

      // Reset
      setMarksStep(1);
      setTestType('');
      setTotalMarks('');
      setSelectedMarksClass('');
      setMarksStudents([]);
      setMarks({});
      setAbsentMarks({});

    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmittingMarks(false);
    }
  };

  // ── PROGRESS ──
  // Subjects come from the class doc's subjects[] (the same array the web
  // dashboard's Manage Subjects writes). A class with none defined yet falls
  // back to whatever this teacher teaches.
  const loadProgSubjects = async (cls: string) => {
    setProgClass(cls);
    setProgSubject('');
    setProgStudents([]);
    setProgStudent(null);
    setShowClassReport(false);
    setLoadingProgSubjects(true);
    try {
      const doc = await firestore()
        .collection('schools').doc(getSchoolCode())
        .collection('classes').doc(cls)
        .get();
      const defined: string[] = (doc.data()?.subjects || [])
        .map((s: any) => String(s?.subject || '').trim())
        .filter(Boolean);
      const fallback = String(teacher?.subject || '')
        .split(',').map((s: string) => s.trim()).filter(Boolean);
      const list = defined.length > 0 ? defined : fallback;
      setProgSubjects(Array.from(new Set(list)));
    } catch (e) {
      console.log('❌ QUANTAIP Error:', e);
      setProgSubjects([]);
    } finally {
      setLoadingProgSubjects(false);
    }
  };

  // Student docs already carry marksMap and teacherNotes, so opening a student
  // needs no further reads.
  const loadProgStudents = async (subject: string) => {
    setProgSubject(subject);
    setProgStudent(null);
    setShowClassReport(false);
    setLoadingProgStudents(true);
    try {
      const snapshot = await firestore()
        .collection('schools').doc(getSchoolCode())
        .collection('students')
        .where('class', '==', progClass)
        .get();
      setProgStudents(snapshot.docs.map(d => d.data()));
    } catch (e) {
      console.log('❌ QUANTAIP Error:', e);
      setProgStudents([]);
    } finally {
      setLoadingProgStudents(false);
    }
  };

  const openProgStudent = (s: any) => {
    setProgStudent(s);
    setNoteText(s?.teacherNotes?.[progSubject]?.note || '');
  };

  // Chronological test history for one student in one subject. Absent tests are
  // left out entirely — plotting them as 0 would invent a score.
  const progressData = (student: any, subject: string) => {
    const entries = Object.values(student?.marksMap || {})
      .filter((m: any) => m.subject === subject && !m.isAbsent)
      .sort((a: any, b: any) => String(a.date || '').localeCompare(String(b.date || ''))) as any[];

    const pcts = entries.map(m => m.percentage || 0);
    const high = pcts.length ? Math.max(...pcts) : 0;
    const low = pcts.length ? Math.min(...pcts) : 0;
    const avg = pcts.length
      ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length)
      : 0;

    // Trend compares the average of the earlier half against the later half.
    // trendDiff is kept numeric so the class report can rank by it.
    let trend = '';
    let trendIcon = '';
    let trendDiff = 0;
    if (pcts.length >= 2) {
      const mid = Math.floor(pcts.length / 2);
      const firstHalf = pcts.slice(0, mid);
      const secondHalf = pcts.slice(mid);
      const avgOf = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
      trendDiff = avgOf(secondHalf) - avgOf(firstHalf);
      trend = trendDiff > 5 ? '📈 Improving' : trendDiff < -5 ? '📉 Declining' : '➡️ Steady';
      trendIcon = trendDiff > 5 ? '📈' : trendDiff < -5 ? '📉' : '➡️';
    }

    const absentCount = Object.values(student?.marksMap || {})
      .filter((m: any) => m.subject === subject && m.isAbsent).length;

    return {entries, high, low, avg, trend, trendIcon, trendDiff, absentCount};
  };

  // ── CLASS PROGRESS REPORT ──
  // Same per-student maths as the individual view, run across the whole class
  // and ranked. Students with no recorded test are listed separately rather
  // than ranked at 0%.
  const buildClassReport = () => {
    // Denominator for "4/5 tests" — every test the class sat in this subject.
    const allTestIds = new Set<string>();
    progStudents.forEach(s => {
      Object.values(s?.marksMap || {}).forEach((m: any) => {
        if (m.subject === progSubject && m.testId) allTestIds.add(m.testId);
      });
    });
    const totalTests = allTestIds.size;

    const rows = progStudents.map(s => {
      const d = progressData(s, progSubject);
      return {
        student: s,
        name: s.fullName || s.name || 'Unknown',
        rollNo: s.rollNo || '—',
        avg: d.avg,
        taken: d.entries.length,
        trend: d.trend,
        trendIcon: d.trendIcon,
        trendDiff: d.trendDiff,
      };
    });

    const ranked = rows
      .filter(r => r.taken > 0)
      .sort((a, b) => b.avg - a.avg);
    const noData = rows.filter(r => r.taken === 0);

    const classAvg = ranked.length
      ? Math.round(ranked.reduce((a, r) => a + r.avg, 0) / ranked.length)
      : 0;

    // Most improved / needs attention only mean something once a student has
    // enough tests for a trend; otherwise fall back to the lowest average.
    const withTrend = ranked.filter(r => r.trend);
    const mostImproved = withTrend.length
      ? withTrend.reduce((best, r) => (r.trendDiff > best.trendDiff ? r : best))
      : null;
    const worstTrend = withTrend.length
      ? withTrend.reduce((worst, r) => (r.trendDiff < worst.trendDiff ? r : worst))
      : null;
    const needsAttention = worstTrend && worstTrend.trendDiff < -5
      ? worstTrend
      : ranked.length ? ranked[ranked.length - 1] : null;

    return {
      ranked,
      noData,
      totalTests,
      classAvg,
      highest: ranked.length ? ranked[0] : null,
      lowest: ranked.length ? ranked[ranked.length - 1] : null,
      mostImproved: mostImproved && mostImproved.trendDiff > 5 ? mostImproved : null,
      needsAttention,
    };
  };

  // Export the report as a PNG and hand it to the share sheet.
  // snapshotContentContainer captures the ScrollView's full content rather than
  // the visible viewport, so every student is in the image however long the
  // class is. Deliberately image-based — react-native-html-to-pdf is the
  // library that caused the "Uri.getScheme() on null" crash and stays out.
  const shareClassReport = async () => {
    if (sharingReport) return;
    setSharingReport(true);
    try {
      const uri = await captureRef(reportRef, {
        format: 'png',
        quality: 0.9,
        snapshotContentContainer: true,
      });

      await Share.open({
        url: uri.startsWith('file://') ? uri : `file://${uri}`,
        type: 'image/png',
        title: `Class Report - ${progClass} - ${progSubject}`,
        failOnCancel: false,
      });
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (!msg.includes('User did not share') && !msg.includes('cancel')) {
        console.log('❌ QUANTAIP Error:', e);
        Alert.alert('Error', 'Could not share report.');
      }
    } finally {
      setSharingReport(false);
    }
  };

  const saveNote = async () => {
    if (!progStudent || !progSubject) return;
    setSavingNote(true);
    try {
      const entry = {
        note: noteText.trim(),
        updatedBy: teacher?.name || teacher?.id || '',
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };
      // merge:true deep-merges maps, so other subjects' notes survive.
      await firestore()
        .collection('schools').doc(getSchoolCode())
        .collection('students').doc(progStudent.id)
        .set({teacherNotes: {[progSubject]: entry}}, {merge: true});

      // Reflect it locally without a re-read (updatedAt shows as "just now").
      const localEntry = {...entry, updatedAt: new Date()};
      const updated = {
        ...progStudent,
        teacherNotes: {...(progStudent.teacherNotes || {}), [progSubject]: localEntry},
      };
      setProgStudent(updated);
      setProgStudents(prev => prev.map(s => (s.id === updated.id ? updated : s)));
      Alert.alert('Note Saved ✅', `Note saved for ${progStudent.fullName || progStudent.name}.`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingNote(false);
    }
  };

  const present = Object.values(attendance).filter(v => v === 'P').length;
  const absent = Object.values(attendance).filter(v => v === 'A').length;
  const late = Object.values(attendance).filter(v => v === 'L').length;
  const allMarked = attStudents.length > 0 && Object.keys(attendance).length === attStudents.length;

  const TABS = [
    ...(inchargeClasses.length > 0 ? [{key: 'Attendance', icon: ClipboardDocumentCheckIcon}] : []),
    {key: 'Marks', icon: PencilSquareIcon},
    {key: 'Progress', icon: ChartBarIcon},
    {key: 'Homework', icon: ClipboardDocumentListIcon},
    {key: 'Timetable', icon: CalendarDaysIcon},
    {key: 'My Classes', icon: BookOpenIcon},
    // Diary is only for class incharges — hidden entirely otherwise
    ...(inchargeClasses.length > 0 ? [{key: 'Diary', icon: DocumentTextIcon}] : []),
  ];

  return (
    <View style={styles.root}>

      {/* NAVBAR */}
      <View style={styles.navbar}>
        <View>
          <Text style={styles.brand}>QUANT<Text style={styles.brandAccent}>AIP</Text></Text>
          <Text style={styles.navSub}>TEACHER PANEL</Text>
        </View>
        <TouchableOpacity onPress={() => {auth().signOut(); navigation.navigate('Login');}}>
          <ArrowRightOnRectangleIcon size={22} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>

      {/* Teacher info */}
      {teacher && (
        <View style={styles.teacherCard}>
          <View style={styles.teacherAv}>
            <Text style={styles.teacherAvTxt}>
              {teacher.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
            </Text>
          </View>
          <View>
            <Text style={styles.teacherName}>{teacher.name}</Text>
            <Text style={styles.teacherMeta}>{teacher.subject} · {today}</Text>
          </View>
        </View>
      )}

      {/* ── ATTENDANCE TAB ── */}
      {tab === 'Attendance' && (
        <View style={styles.flex}>
          {!selectedAttClass ? (
            <ScrollView style={styles.content}>
              <Text style={styles.sectionTitle}>Select Class for Attendance</Text>
              {inchargeClasses.map((cls, i) => (
                <TouchableOpacity key={i} style={styles.classBtn}
                  onPress={() => loadAttStudents(cls)}>
                  <View style={styles.classBtnLeft}>
                    <BookOpenIcon size={20} color="#B8960A" />
                    <View>
                      <Text style={styles.classBtnTxt}>{cls}</Text>
                      <Text style={styles.classBtnSub}>Class Incharge · {today}</Text>
                    </View>
                  </View>
                  <ClipboardDocumentCheckIcon size={18} color="#9ca3af" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : attSubmitted ? (
            <View style={styles.successWrap}>
              <View style={styles.successIcon}>
                <CheckCircleIcon size={48} color="#16a34a" />
              </View>
              <Text style={styles.successTitle}>Submitted!</Text>
              <View style={styles.successStats}>
                <View style={styles.sstat}>
                  <Text style={[styles.sstatVal, {color: '#16a34a'}]}>{present}</Text>
                  <Text style={styles.sstatLbl}>Present</Text>
                </View>
                <View style={styles.sstat}>
                  <Text style={[styles.sstatVal, {color: '#ef4444'}]}>{absent}</Text>
                  <Text style={styles.sstatLbl}>Absent</Text>
                </View>
                <View style={styles.sstat}>
                  <Text style={[styles.sstatVal, {color: '#f59e0b'}]}>{late}</Text>
                  <Text style={styles.sstatLbl}>Late</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.backBtn}
                onPress={() => {setSelectedAttClass(''); setAttStudents([]); setAttendance({}); setAttSubmitted(false);}}>
                <Text style={styles.backBtnTxt}>Mark Another Class</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.flex}>
              <View style={styles.classHeader}>
                <TouchableOpacity onPress={() => {setSelectedAttClass(''); setAttStudents([]); setAttendance({});}}>
                  <Text style={styles.backLink}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.className}>{selectedAttClass}</Text>
              </View>
              <View style={styles.summaryRow}>
                <View style={[styles.summaryCard, {backgroundColor: '#f0fdf4', borderColor: '#bbf7d0'}]}>
                  <Text style={[styles.summaryVal, {color: '#16a34a'}]}>{present}</Text>
                  <Text style={styles.summaryLbl}>Present</Text>
                </View>
                <View style={[styles.summaryCard, {backgroundColor: '#fef2f2', borderColor: '#fecaca'}]}>
                  <Text style={[styles.summaryVal, {color: '#ef4444'}]}>{absent}</Text>
                  <Text style={styles.summaryLbl}>Absent</Text>
                </View>
                <View style={[styles.summaryCard, {backgroundColor: '#fffbeb', borderColor: '#fde68a'}]}>
                  <Text style={[styles.summaryVal, {color: '#f59e0b'}]}>{late}</Text>
                  <Text style={styles.summaryLbl}>Late</Text>
                </View>
              </View>
              {!loadingAtt && attStudents.length > 0 && (
                <View style={styles.bulkRow}>
                  <TouchableOpacity style={[styles.bulkBtn, styles.bulkBtnPresent]} onPress={markAllPresent}>
                    <Text style={[styles.bulkBtnTxt, {color: '#16a34a'}]}>✓ Mark All Present</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.bulkBtn, styles.bulkBtnAbsent]} onPress={markAllAbsent}>
                    <Text style={[styles.bulkBtnTxt, {color: '#ef4444'}]}>✗ Mark All Absent</Text>
                  </TouchableOpacity>
                </View>
              )}
              {loadingAtt ? (
                <ActivityIndicator color="#B8960A" size="large" style={{marginTop: 30}} />
              ) : (
                <ScrollView style={styles.content}>
                  {attStudents.map((s, i) => {
                    const status = attendance[s.id];
                    return (
                      <View key={i} style={styles.studentRow}>
                        <View style={[styles.studentAv,
                          status === 'P' && styles.avP,
                          status === 'A' && styles.avA,
                          status === 'L' && styles.avL,
                        ]}>
                          <Text style={[styles.studentAvTxt,
                            status === 'P' && {color: '#16a34a'},
                            status === 'A' && {color: '#ef4444'},
                            status === 'L' && {color: '#f59e0b'},
                          ]}>
                            {(s.fullName || s.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                          </Text>
                        </View>
                        <View style={styles.studentInfo}>
                          <Text style={styles.studentName}>{s.fullName || s.name}</Text>
                          <Text style={styles.studentRoll}>{s.rollNo || s.id}</Text>
                        </View>
                        <View style={styles.btnGroup}>
                          {[
                            {key: 'P', activeColor: '#16a34a', activeBg: '#f0fdf4', activeBorder: '#86efac'},
                            {key: 'A', activeColor: '#ef4444', activeBg: '#fef2f2', activeBorder: '#fca5a5'},
                            {key: 'L', activeColor: '#f59e0b', activeBg: '#fffbeb', activeBorder: '#fcd34d'},
                          ].map(btn => (
                            <TouchableOpacity key={btn.key}
                              style={[styles.attBtn,
                                status === btn.key && {backgroundColor: btn.activeBg, borderColor: btn.activeBorder}
                              ]}
                              onPress={() => {
                                setAttendance(prev => ({...prev, [s.id]: btn.key}));
                                if (btn.key === 'A') {setAbsentAlert(s);}
                              }}>
                              <Text style={[styles.attBtnTxt,
                                status === btn.key && {color: btn.activeColor, fontWeight: '700'}
                              ]}>{btn.key}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    );
                  })}
                  <View style={{height: 100}} />
                </ScrollView>
              )}
              <View style={styles.submitBar}>
                <TouchableOpacity
                  style={[styles.submitBtn, !allMarked && styles.submitBtnOff]}
                  disabled={!allMarked || submittingAtt}
                  onPress={submitAttendance}>
                  {submittingAtt ? <ActivityIndicator color="#ffffff" /> :
                    <Text style={styles.submitBtnTxt}>
                      {allMarked ? 'Submit Attendance' : `Mark all (${Object.keys(attendance).length}/${attStudents.length})`}
                    </Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* ── MARKS TAB ── */}
      {tab === 'Marks' && (
        <ScrollView style={styles.content}>

          {/* Step 1 — Test Type */}
          {marksStep === 1 && (
            <View>
              <Text style={styles.sectionTitle}>Step 1 — Select Test Type</Text>
              {TEST_TYPES.map((t, i) => (
                <TouchableOpacity key={i}
                  style={[styles.testTypeBtn, testType === t.key && styles.testTypeBtnOn]}
                  onPress={() => setTestType(t.key)}>
                  <Text style={[styles.testTypeTxt, testType === t.key && styles.testTypeTxtOn]}>
                    {t.label}
                  </Text>
                  {testType === t.key && <CheckCircleIcon size={18} color="#B8960A" />}
                </TouchableOpacity>
              ))}

              <Text style={[styles.sectionTitle, {marginTop: 20}]}>Total Marks</Text>
              <TextInput
                style={styles.marksInput}
                placeholder="e.g. 20"
                placeholderTextColor="#b8a88a"
                keyboardType="number-pad"
                value={totalMarks}
                onChangeText={setTotalMarks}
              />

              <TouchableOpacity
                style={[styles.nextBtn, (!testType || !totalMarks) && styles.nextBtnOff]}
                disabled={!testType || !totalMarks}
                onPress={() => setMarksStep(2)}>
                <Text style={styles.nextBtnTxt}>Next — Select Class →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 2 — Select Class */}
          {marksStep === 2 && (
            <View>
              <View style={styles.stepHeader}>
                <TouchableOpacity onPress={() => setMarksStep(1)}>
                  <Text style={styles.backLink}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.sectionTitle}>Step 2 — Select Class</Text>
              </View>

              <View style={styles.testSummary}>
                <Text style={styles.testSummaryTxt}>
                  {TEST_TYPES.find(t => t.key === testType)?.label} · {teacher?.subject} · {totalMarks} marks
                </Text>
              </View>

              {classes.length === 0 ? (
                <View style={styles.emptyBox}>
                  <BookOpenIcon size={40} color="#b8a88a" />
                  <Text style={styles.emptyTxt}>No classes assigned</Text>
                </View>
              ) : (
                classes.map((cls, i) => (
                  <TouchableOpacity key={i} style={styles.classBtn}
                    onPress={() => loadMarksStudents(cls)}>
                    <View style={styles.classBtnLeft}>
                      <AcademicCapIcon size={20} color="#B8960A" />
                      <Text style={styles.classBtnTxt}>{cls}</Text>
                    </View>
                    <ChartBarIcon size={18} color="#9ca3af" />
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {/* Step 3 — Enter Marks */}
          {marksStep === 3 && (
            <View>
              <View style={styles.stepHeader}>
                <TouchableOpacity onPress={() => setMarksStep(2)}>
                  <Text style={styles.backLink}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.sectionTitle}>Enter Marks</Text>
              </View>

              <View style={styles.testSummary}>
                <Text style={styles.testSummaryTxt}>
                  {TEST_TYPES.find(t => t.key === testType)?.label} · {selectedMarksClass} · {teacher?.subject} · /{totalMarks}
                </Text>
              </View>

              {loadingMarks ? (
                <ActivityIndicator color="#B8960A" size="large" style={{marginTop: 30}} />
              ) : (
                marksStudents.map((s, i) => {
                  const isAbsent = !!absentMarks[s.id];
                  const obtained = marks[s.id] || '';
                  const total = parseInt(totalMarks);
                  const pct = obtained ? Math.round((parseInt(obtained) / total) * 100) : 0;
                  const isOver = !isAbsent && obtained && parseInt(obtained) > total;

                  // Toggling Absent on clears whatever number was typed, so an
                  // absent student can never be saved with a score.
                  const toggleAbsent = () => {
                    setAbsentMarks(prev => ({...prev, [s.id]: !prev[s.id]}));
                    if (!isAbsent) {
                      setMarks(prev => ({...prev, [s.id]: ''}));
                    }
                  };

                  return (
                    <View key={i} style={styles.marksRow}>
                      <View style={styles.studentAv}>
                        <Text style={styles.studentAvTxt}>
                          {(s.fullName || s.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                        </Text>
                      </View>
                      <View style={styles.studentInfo}>
                        <Text style={styles.studentName}>{s.fullName || s.name}</Text>
                        <Text style={styles.studentRoll}>
                          {isAbsent ? 'Absent (AB)' : obtained ? `${pct}%` : 'Not entered'}
                        </Text>
                      </View>
                      <View style={styles.marksInputWrap}>
                        <TextInput
                          style={[
                            styles.marksInputSmall,
                            isOver && {borderColor: '#ef4444'},
                            isAbsent && styles.marksInputOff,
                          ]}
                          placeholder={isAbsent ? '—' : '0'}
                          placeholderTextColor="#b8a88a"
                          keyboardType="number-pad"
                          editable={!isAbsent}
                          value={isAbsent ? '' : obtained}
                          onChangeText={val => setMarks(prev => ({...prev, [s.id]: val}))}
                        />
                        <Text style={styles.marksTotal}>/{totalMarks}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.absentToggle}
                        onPress={toggleAbsent}
                        accessibilityRole="checkbox"
                        accessibilityState={{checked: isAbsent}}>
                        <View style={[styles.absentBox, isAbsent && styles.absentBoxOn]}>
                          {isAbsent && <Text style={styles.absentTick}>✓</Text>}
                        </View>
                        <Text style={[styles.absentLbl, isAbsent && styles.absentLblOn]}>Absent</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}

              {marksStudents.length > 0 && (
                <TouchableOpacity
                  style={[styles.submitBtn, {marginTop: 16, marginBottom: 30}]}
                  onPress={submitMarks}
                  disabled={submittingMarks}>
                  {submittingMarks ? <ActivityIndicator color="#ffffff" /> :
                    <Text style={styles.submitBtnTxt}>Submit Marks ✅</Text>}
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {/* ── PROGRESS TAB ── */}
      {/* Selection + individual views. The class report renders separately
          below so its ScrollView can be captured as an image. */}
      {tab === 'Progress' && !(showClassReport && !progStudent) && (
        <ScrollView style={styles.content}>
          {!progStudent ? (
            <View>
              <Text style={styles.sectionTitle}>Student Progress</Text>

              {/* Step 1 — class */}
              <Text style={styles.fieldLabel}>CLASS</Text>
              {classes.length === 0 ? (
                <Text style={styles.noClassTxt}>
                  No classes assigned to you yet. Ask your admin to assign classes.
                </Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 14}}>
                  {classes.map((cls, i) => (
                    <TouchableOpacity key={i}
                      style={[styles.progChip, progClass === cls && styles.progChipOn]}
                      onPress={() => loadProgSubjects(cls)}>
                      <Text style={[styles.progChipTxt, progClass === cls && styles.progChipTxtOn]}>
                        {cls}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* Step 2 — subject */}
              {progClass ? (
                loadingProgSubjects ? (
                  <ActivityIndicator color="#B8960A" style={{marginVertical: 16}} />
                ) : progSubjects.length === 0 ? (
                  <Text style={styles.noClassTxt}>
                    No subjects defined for {progClass}. Add them from the web dashboard's
                    Manage Subjects screen.
                  </Text>
                ) : (
                  <>
                    <Text style={styles.fieldLabel}>SUBJECT</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 14}}>
                      {progSubjects.map((sub, i) => (
                        <TouchableOpacity key={i}
                          style={[styles.progChip, progSubject === sub && styles.progChipOn]}
                          onPress={() => loadProgStudents(sub)}>
                          <Text style={[styles.progChipTxt, progSubject === sub && styles.progChipTxtOn]}>
                            {sub}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                )
              ) : null}

              {/* Step 3 — student list */}
              {progSubject ? (
                loadingProgStudents ? (
                  <ActivityIndicator color="#B8960A" size="large" style={{marginTop: 20}} />
                ) : progStudents.length === 0 ? (
                  <Text style={styles.noClassTxt}>No students found in {progClass}.</Text>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.classReportBtn}
                      onPress={() => setShowClassReport(true)}>
                      <ChartBarIcon size={17} color="#C9A84C" />
                      <Text style={styles.classReportBtnTxt}>View Class Report</Text>
                    </TouchableOpacity>

                    <Text style={styles.fieldLabel}>
                      STUDENTS — {progClass} · {progSubject}
                    </Text>
                    {progStudents.map((s, i) => {
                      const {entries, avg} = progressData(s, progSubject);
                      const hasNote = !!s?.teacherNotes?.[progSubject]?.note;
                      return (
                        <TouchableOpacity key={i} style={styles.progRow} onPress={() => openProgStudent(s)}>
                          <View style={styles.studentAv}>
                            <Text style={styles.studentAvTxt}>
                              {(s.fullName || s.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                            </Text>
                          </View>
                          <View style={styles.studentInfo}>
                            <Text style={styles.studentName}>{s.fullName || s.name}</Text>
                            <Text style={styles.studentRoll}>
                              {entries.length > 0
                                ? `${entries.length} test(s) · avg ${avg}%`
                                : 'No tests yet'}
                              {hasNote ? ' · 📝' : ''}
                            </Text>
                          </View>
                          <ChartBarIcon size={18} color="#B8960A" />
                        </TouchableOpacity>
                      );
                    })}
                  </>
                )
              ) : null}
              <View style={{height: 40}} />
            </View>
          ) : (
            /* ── Single student's progress view ── */
            (() => {
              const {entries, high, low, avg, trend, absentCount} =
                progressData(progStudent, progSubject);
              const noteMeta = progStudent?.teacherNotes?.[progSubject];
              const updatedAt = noteMeta?.updatedAt?.toDate
                ? noteMeta.updatedAt.toDate()
                : noteMeta?.updatedAt instanceof Date
                  ? noteMeta.updatedAt
                  : null;

              return (
                <View>
                  <View style={styles.stepHeader}>
                    <TouchableOpacity onPress={() => setProgStudent(null)}>
                      <Text style={styles.backLink}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.sectionTitle}>
                      {progStudent.fullName || progStudent.name}
                    </Text>
                  </View>
                  <View style={styles.testSummary}>
                    <Text style={styles.testSummaryTxt}>
                      {progClass} · {progSubject} · {entries.length} test(s)
                      {absentCount > 0 ? ` · ${absentCount} absent` : ''}
                    </Text>
                  </View>

                  {/* Bar chart — plain Views, heights proportional to percentage */}
                  {entries.length === 0 ? (
                    <View style={styles.progEmpty}>
                      <ChartBarIcon size={34} color="#b8a88a" />
                      <Text style={styles.progEmptyTxt}>
                        No marks recorded for {progSubject} yet.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.chartCard}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.chartRow}>
                          {entries.map((m: any, i: number) => {
                            const pct = m.percentage || 0;
                            const col = pct >= 80 ? '#16a34a' : pct >= 60 ? '#B8960A'
                              : pct >= 40 ? '#f59e0b' : '#ef4444';
                            return (
                              <View key={i} style={styles.chartCol}>
                                <Text style={styles.chartPct}>{pct}%</Text>
                                <View style={styles.chartTrack}>
                                  <View style={[styles.chartBar, {
                                    height: Math.max(4, (pct / 100) * 120),
                                    backgroundColor: col,
                                  }]} />
                                </View>
                                <Text style={styles.chartLbl} numberOfLines={2}>
                                  {m.typeName || TEST_TYPES.find(t => t.key === m.testType)?.label || m.testType}
                                </Text>
                                <Text style={styles.chartDate}>{m.date}</Text>
                              </View>
                            );
                          })}
                        </View>
                      </ScrollView>
                    </View>
                  )}

                  {/* Summary stats */}
                  {entries.length > 0 && (
                    <View style={styles.statRow}>
                      {[
                        {label: 'Highest', value: `${high}%`, color: '#16a34a'},
                        {label: 'Lowest', value: `${low}%`, color: '#ef4444'},
                        {label: 'Average', value: `${avg}%`, color: '#B8960A'},
                      ].map((st, i) => (
                        <View key={i} style={styles.statBox}>
                          <Text style={[styles.statVal, {color: st.color}]}>{st.value}</Text>
                          <Text style={styles.statLbl}>{st.label}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {trend ? (
                    <View style={styles.trendBox}>
                      <Text style={styles.trendTxt}>{trend}</Text>
                    </View>
                  ) : null}

                  {/* Teacher's note for this subject */}
                  <View style={styles.noteCard}>
                    <Text style={styles.noteTitle}>📝 Teacher's Note — {progSubject}</Text>
                    <TextInput
                      style={styles.noteInput}
                      placeholder="e.g. Needs to practice algebra problems more. Strong in geometry."
                      placeholderTextColor="#b8a88a"
                      value={noteText}
                      onChangeText={setNoteText}
                      multiline
                      textAlignVertical="top"
                    />
                    {noteMeta?.note ? (
                      <Text style={styles.noteMeta}>
                        Last updated{updatedAt ? ` ${updatedAt.toLocaleDateString()}` : ''}
                        {noteMeta.updatedBy ? ` by ${noteMeta.updatedBy}` : ''}
                      </Text>
                    ) : null}
                    <TouchableOpacity
                      style={styles.noteSaveBtn}
                      onPress={saveNote}
                      disabled={savingNote}>
                      {savingNote ? <ActivityIndicator color="#C9A84C" /> :
                        <Text style={styles.noteSaveTxt}>Save Note</Text>}
                    </TouchableOpacity>
                  </View>
                  <View style={{height: 40}} />
                </View>
              );
            })()
          )}
        </ScrollView>
      )}

      {/* ── CLASS PROGRESS REPORT ──
          Its own screen so the ScrollView itself can be the capture target:
          captureRef with snapshotContentContainer grabs the whole scrollable
          content, not just the visible viewport, so a 30-student class exports
          in full. The Back/Share bar sits outside the ScrollView and so stays
          out of the image. */}
      {tab === 'Progress' && showClassReport && !progStudent && (
        <View style={{flex: 1}}>
          <View style={styles.reportBar}>
            <TouchableOpacity onPress={() => setShowClassReport(false)}>
              <Text style={styles.backLink}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.shareReportBtn}
              onPress={shareClassReport}
              disabled={sharingReport}>
              {sharingReport ? <ActivityIndicator size="small" color="#C9A84C" /> :
                <Text style={styles.shareReportTxt}>📤 Share Report</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView ref={reportRef} style={styles.content} collapsable={false}>
            {(() => {
              const rep = buildClassReport();
              const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '');

              return (
                <View style={styles.reportCapture} collapsable={false}>
                  {/* Header — kept inside the capture so a shared image is
                      self-explanatory on its own. */}
                  <View style={styles.reportHeader}>
                    <Text style={styles.reportTitle}>{progClass} — {progSubject}</Text>
                    <Text style={styles.reportSub}>
                      Class Progress Report · {schoolName || getSchoolCode()} · {today}
                    </Text>
                    <Text style={styles.reportSub}>
                      {rep.ranked.length} student(s) ranked · {rep.totalTests} test(s)
                    </Text>
                  </View>

                  {/* Class summary */}
                  <View style={styles.repSummaryCard}>
                    <View style={styles.repSummaryTopRow}>
                      <Text style={styles.repSummaryAvgVal}>{rep.classAvg}%</Text>
                      <Text style={styles.repSummaryAvgLbl}>CLASS AVERAGE</Text>
                    </View>
                    {[
                      {label: 'Highest', row: rep.highest, suffix: rep.highest ? `${rep.highest.avg}%` : ''},
                      {label: 'Lowest', row: rep.lowest, suffix: rep.lowest ? `${rep.lowest.avg}%` : ''},
                      {label: 'Most Improved', row: rep.mostImproved, suffix: '📈'},
                      {label: 'Needs Attention', row: rep.needsAttention, suffix: '⚠️'},
                    ].map((item, i) => (
                      <View key={i} style={styles.repSummaryRow}>
                        <Text style={styles.repSummaryLbl}>{item.label}</Text>
                        <Text style={styles.repSummaryVal}>
                          {item.row ? `${item.row.name} — ${item.suffix}` : '—'}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Ranked list */}
                  {rep.ranked.length === 0 ? (
                    <View style={styles.progEmpty}>
                      <ChartBarIcon size={34} color="#b8a88a" />
                      <Text style={styles.progEmptyTxt}>
                        No test data recorded for {progSubject} yet.
                      </Text>
                    </View>
                  ) : (
                    rep.ranked.map((r, i) => (
                      <TouchableOpacity
                        key={i}
                        style={styles.rankRow}
                        onPress={() => openProgStudent(r.student)}>
                        <Text style={[styles.rankNum, i < 3 && styles.rankNumTop]}>
                          {medal(i) ? `${medal(i)} ` : ''}{i + 1}.
                        </Text>
                        <View style={styles.rankInfo}>
                          <Text style={styles.rankName}>{r.name}</Text>
                          <Text style={styles.rankMeta}>
                            Roll No: {r.rollNo} · {r.taken}/{rep.totalTests} tests
                          </Text>
                        </View>
                        <View style={styles.rankRight}>
                          <Text style={styles.rankPct}>{r.avg}%</Text>
                          {r.trendIcon ? <Text style={styles.rankTrend}>{r.trendIcon}</Text> : null}
                        </View>
                      </TouchableOpacity>
                    ))
                  )}

                  {/* Students with nothing recorded — listed, never ranked */}
                  {rep.noData.length > 0 && (
                    <View style={{marginTop: 16}}>
                      <Text style={styles.fieldLabel}>NO TEST DATA YET ({rep.noData.length})</Text>
                      {rep.noData.map((r, i) => (
                        <TouchableOpacity
                          key={i}
                          style={styles.noDataRow}
                          onPress={() => openProgStudent(r.student)}>
                          <Text style={styles.noDataName}>{r.name}</Text>
                          <Text style={styles.noDataMeta}>Roll No: {r.rollNo}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <Text style={styles.reportFooter}>Generated by QUANTAIP EduOS</Text>
                </View>
              );
            })()}
            <View style={{height: 40}} />
          </ScrollView>
        </View>
      )}

      {/* ── MY CLASSES TAB ── */}
      {tab === 'Homework' && (
        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>Assign Homework</Text>

          {/* Class selector — only assigned classes */}
          {classes.length === 0 && (
            <Text style={styles.noClassTxt}>
              No classes assigned to you yet. Ask your admin to assign classes.
            </Text>
          )}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 12}}>
            {classes.map((cls, i) => (
              <TouchableOpacity key={i}
                style={{
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8,
                  backgroundColor: hwClass === cls ? '#0d1f3c' : '#ffffff',
                  borderWidth: 1, borderColor: hwClass === cls ? '#0d1f3c' : '#ece5d3',
                }}
                onPress={() => loadHomework(cls)}>
                <Text style={{
                  fontSize: 12, fontWeight: '600',
                  color: hwClass === cls ? '#C9A84C' : '#6b7280',
                }}>{cls}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {hwClass ? (
            <View>
              {/* Assign form */}
              <View style={{
                backgroundColor: '#ffffff', borderRadius: 14, padding: 14,
                borderWidth: 1, borderColor: '#ece5d3', marginBottom: 16,
              }}>
                <TextInput
                  style={{
                    borderWidth: 1, borderColor: '#ece5d3', borderRadius: 8,
                    paddingHorizontal: 12, paddingVertical: 8, fontSize: 13,
                    color: '#0d1f3c', marginBottom: 8,
                  }}
                  placeholder="Subject (e.g. Physics)"
                  placeholderTextColor="#b8a88a"
                  value={hwSubject}
                  onChangeText={setHwSubject}
                />
                <TextInput
                  style={{
                    borderWidth: 1, borderColor: '#ece5d3', borderRadius: 8,
                    paddingHorizontal: 12, paddingVertical: 8, fontSize: 13,
                    color: '#0d1f3c', marginBottom: 8,
                  }}
                  placeholder="Title (e.g. Chapter 15 Exercise)"
                  placeholderTextColor="#b8a88a"
                  value={hwTitle}
                  onChangeText={setHwTitle}
                />
                <TextInput
                  style={{
                    borderWidth: 1, borderColor: '#ece5d3', borderRadius: 8,
                    paddingHorizontal: 12, paddingVertical: 8, fontSize: 13,
                    color: '#0d1f3c', marginBottom: 8, minHeight: 70,
                    textAlignVertical: 'top',
                  }}
                  placeholder="Details (e.g. Solve Q1 to Q5 from exercise)"
                  placeholderTextColor="#b8a88a"
                  value={hwDesc}
                  onChangeText={setHwDesc}
                  multiline
                />
                <TextInput
                  style={{
                    borderWidth: 1, borderColor: '#ece5d3', borderRadius: 8,
                    paddingHorizontal: 12, paddingVertical: 8, fontSize: 13,
                    color: '#0d1f3c', marginBottom: 12,
                  }}
                  placeholder="Due date (YYYY-MM-DD)"
                  placeholderTextColor="#b8a88a"
                  value={hwDue}
                  onChangeText={setHwDue}
                />
                <TouchableOpacity
                  style={{
                    backgroundColor: '#0d1f3c', borderRadius: 10,
                    padding: 13, alignItems: 'center',
                  }}
                  disabled={assigningHW}
                  onPress={assignHomework}>
                  {assigningHW ? <ActivityIndicator color="#C9A84C" /> : (
                    <Text style={{color: '#C9A84C', fontSize: 14, fontWeight: '700'}}>
                      Assign to {hwClass}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Recent homework list */}
              <Text style={styles.sectionTitle}>Recent — {hwClass}</Text>
              {loadingHW && <ActivityIndicator color="#B8960A" style={{marginVertical: 16}} />}
              {!loadingHW && hwList.length === 0 && (
                <Text style={{fontSize: 13, color: '#9ca3af', textAlign: 'center', marginTop: 12}}>
                  No homework assigned yet.
                </Text>
              )}
              {!loadingHW && hwList.map((hw: any, i: number) => (
                <View key={i} style={{
                  backgroundColor: '#ffffff', borderRadius: 14, padding: 14,
                  borderWidth: 1, borderColor: '#ece5d3', marginBottom: 8,
                }}>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                    <Text style={{fontSize: 11, fontWeight: '700', color: '#B8960A'}}>{hw.subject}</Text>
                    <Text style={{fontSize: 11, color: '#9ca3af'}}>Due: {hw.dueDate}</Text>
                  </View>
                  <Text style={{fontSize: 14, fontWeight: '600', color: '#0d1f3c', marginTop: 4}}>{hw.title}</Text>
                  {hw.description ? (
                    <Text style={{fontSize: 12, color: '#6b7280', marginTop: 2}}>{hw.description}</Text>
                  ) : null}
                  <Text style={{fontSize: 11, color: '#9ca3af', marginTop: 6}}>
                    {hw.teacherName} · {hw.assignedDate}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{fontSize: 13, color: '#9ca3af', textAlign: 'center', marginTop: 20}}>
              Select a class above to assign homework
            </Text>
          )}

          <View style={{height: 30}} />
        </ScrollView>
      )}

      {tab === 'Timetable' && (
        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>Class Timetable</Text>

          {/* Class selector — only assigned classes */}
          {classes.length === 0 && (
            <Text style={styles.noClassTxt}>
              No classes assigned to you yet. Ask your admin to assign classes.
            </Text>
          )}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 12}}>
            {classes.map((cls, i) => (
              <TouchableOpacity key={i}
                style={{
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8,
                  backgroundColor: ttClass === cls ? '#0d1f3c' : '#ffffff',
                  borderWidth: 1, borderColor: ttClass === cls ? '#0d1f3c' : '#ece5d3',
                }}
                onPress={() => loadTeacherTimetable(cls)}>
                <Text style={{
                  fontSize: 12, fontWeight: '600',
                  color: ttClass === cls ? '#C9A84C' : '#6b7280',
                }}>{cls}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {ttClass ? (
            <View>
              {/* Day selector */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 12}}>
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => (
                  <TouchableOpacity key={i}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8,
                      backgroundColor: ttDay === d ? '#0d1f3c' : '#ffffff',
                      borderWidth: 1, borderColor: ttDay === d ? '#0d1f3c' : '#ece5d3',
                    }}
                    onPress={() => setTtDay(d)}>
                    <Text style={{
                      fontSize: 12, fontWeight: '600',
                      color: ttDay === d ? '#C9A84C' : '#6b7280',
                    }}>{d.slice(0, 3)}{d === 'Friday' ? ' 🕌' : ''}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {loadingTT && <ActivityIndicator color="#B8960A" style={{marginVertical: 20}} />}

              {!loadingTT && ttData && ttData[ttDay] ? (
                ttData[ttDay].map((t: any, i: number) => {
                  const isMine = t.teacher && teacher?.name &&
                    t.teacher.toLowerCase().includes(teacher.name.toLowerCase());
                  return (
                    <View key={i} style={{
                      backgroundColor: t.period === 0 ? '#f0fdf4' : isMine ? '#fdf8ee' : '#ffffff',
                      borderRadius: 14, padding: 14, marginBottom: 8,
                      borderWidth: isMine ? 1.5 : 1,
                      borderColor: t.period === 0 ? '#bbf7d0' : isMine ? '#B8960A' : '#ece5d3',
                      flexDirection: 'row', alignItems: 'center', gap: 12,
                    }}>
                      <View style={{minWidth: 90}}>
                        <Text style={{fontSize: 11, fontWeight: '700', color: '#B8960A'}}>{t.time}</Text>
                      </View>
                      <View style={{flex: 1}}>
                        <Text style={{
                          fontSize: 14, fontWeight: '600',
                          color: t.period === 0 ? '#16a34a' : '#0d1f3c',
                        }}>{t.period === 0 ? '🍎 Break' : t.subject || '—'}</Text>
                        {t.teacher ? (
                          <Text style={{fontSize: 12, color: '#9ca3af', marginTop: 2}}>
                            {t.teacher}{isMine ? '  ⭐ Your period' : ''}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })
              ) : !loadingTT ? (
                <Text style={{fontSize: 13, color: '#9ca3af', textAlign: 'center', marginTop: 20}}>
                  Timetable has not been set for this class yet.
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={{fontSize: 13, color: '#9ca3af', textAlign: 'center', marginTop: 20}}>
              Select a class above to view its timetable
            </Text>
          )}

          <View style={{height: 30}} />
        </ScrollView>
      )}

      {tab === 'My Classes' && (
        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>Assigned Classes</Text>
          {classes.length === 0 ? (
            <View style={styles.emptyBox}>
              <BookOpenIcon size={40} color="#b8a88a" />
              <Text style={styles.emptyTxt}>No classes assigned</Text>
            </View>
          ) : (
            classes.map((cls, i) => (
              <View key={i} style={styles.myClassCard}>
                <View style={styles.myClassLeft}>
                  <View style={[styles.myClassIcon,
                    inchargeClasses.includes(cls) && {backgroundColor: '#f0fdf4'}]}>
                    <BookOpenIcon size={20} color={inchargeClasses.includes(cls) ? '#16a34a' : '#B8960A'} />
                  </View>
                  <View>
                    <Text style={styles.myClassName}>{cls}</Text>
                    <Text style={styles.myClassSub}>
                      {inchargeClasses.includes(cls) ? '✅ Class Incharge' : teacher?.subject}
                    </Text>
                  </View>
                </View>
                <View style={styles.myClassActions}>
                  {inchargeClasses.includes(cls) && (
                    <TouchableOpacity
                      style={styles.markBtn}
                      onPress={() => {setTab('Attendance'); loadAttStudents(cls);}}>
                      <Text style={styles.markBtnTxt}>Attend</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.markBtn}
                    onPress={() => {
                      setTab('Marks');
                      setMarksStep(2);
                      setSelectedMarksClass(cls);
                      loadMarksStudents(cls);
                    }}>
                    <Text style={styles.markBtnTxt}>Marks</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* ── DIARY TAB ── */}
      {tab === 'Diary' && (
        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>Daily Diary Generator</Text>

          {/* Class selector — only classes this teacher is incharge of */}
          <Text style={styles.diaryLabel}>Class</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 14}}>
            {inchargeClasses.length === 0 ? (
              <Text style={{fontSize: 13, color: '#9ca3af'}}>No incharge classes</Text>
            ) : (
              inchargeClasses.map((cls, i) => (
                <TouchableOpacity key={i}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8,
                    backgroundColor: diaryClass === cls ? '#0d1f3c' : '#ffffff',
                    borderWidth: 1, borderColor: diaryClass === cls ? '#0d1f3c' : '#ece5d3',
                  }}
                  onPress={() => {setDiaryClass(cls); setDiaryGenerated(false);}}>
                  <Text style={{
                    fontSize: 12, fontWeight: '600',
                    color: diaryClass === cls ? '#C9A84C' : '#6b7280',
                  }}>{cls}</Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>

          {/* Date selector */}
          <Text style={styles.diaryLabel}>Date</Text>
          <View style={{flexDirection: 'row', gap: 8, marginBottom: 6}}>
            <TextInput
              style={[styles.marksInput, {flex: 1, marginBottom: 0}]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#b8a88a"
              value={diaryDate}
              onChangeText={val => {setDiaryDate(val); setDiaryGenerated(false);}}
            />
            <TouchableOpacity
              style={styles.diaryTodayBtn}
              onPress={() => {setDiaryDate(todayKey()); setDiaryGenerated(false);}}>
              <Text style={styles.diaryTodayTxt}>Today</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.diaryDayHint}>{dayNameOf(diaryDate)}</Text>

          {/* Generate button */}
          <TouchableOpacity
            style={[styles.diaryGenBtn, (!diaryClass || generatingDiary) && styles.nextBtnOff]}
            disabled={!diaryClass || generatingDiary}
            onPress={generateDiary}>
            {generatingDiary ? <ActivityIndicator color="#C9A84C" /> : (
              <Text style={styles.diaryGenTxt}>📄  Generate Diary</Text>
            )}
          </TouchableOpacity>

          {/* Preview + share */}
          {diaryGenerated && (
            <View style={{marginTop: 20}}>
              <View style={styles.diarySheet}>
                <Text style={styles.diarySheetSchool}>Daily Diary</Text>
                <Text style={styles.diarySheetMeta}>
                  {prettyDate(diaryDate)} · {dayNameOf(diaryDate)} · {diaryClass}
                </Text>

                <View style={styles.diaryHeadRow}>
                  <Text style={[styles.diaryHeadCell, {flex: 1}]}>Subject</Text>
                  <Text style={[styles.diaryHeadCell, {flex: 2}]}>Daily Tasks</Text>
                </View>
                {diaryRows.map((r, i) => (
                  <View key={i} style={styles.diaryBodyRow}>
                    <Text style={[styles.diarySubjCell, {flex: 1}]}>{r.subject}</Text>
                    <Text style={[styles.diaryTaskCell, {flex: 2}]}>
                      {r.task || '—'}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={{flexDirection: 'row', gap: 8, marginTop: 14}}>
                <TouchableOpacity
                  style={[styles.diaryShareBtn, {flex: 1}]}
                  disabled={sharingDiary}
                  onPress={shareDiaryAsHTML}>
                  {sharingDiary ? <ActivityIndicator color="#C9A84C" /> : (
                    <Text style={styles.diaryShareTxt}>⬇  Download / Share</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.diaryShareBtnAlt, {flex: 1}]}
                  disabled={sharingDiary}
                  onPress={shareDiaryText}>
                  <Text style={styles.diaryShareTxtAlt}>💬  Share Text</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={{height: 40}} />
        </ScrollView>
      )}

      {/* BOTTOM TAB BAR */}
      <View style={styles.bottomBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.bottomBarContent}>
          {TABS.map(({key, icon: TabIcon}) => (
            <TouchableOpacity key={key} style={styles.bottomTab} onPress={() => setTab(key)}>
              <TabIcon size={22} color={tab === key ? '#B8960A' : '#94a3b8'} />
              <Text style={[styles.bottomTabTxt, tab === key && styles.bottomTabTxtOn]}>{key}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ABSENT WHATSAPP ALERT — bottom sheet */}
      <Modal
        visible={!!absentAlert}
        transparent
        animationType="slide"
        onRequestClose={() => setAbsentAlert(null)}>
        <TouchableOpacity
          style={styles.sheetBackdrop}
          activeOpacity={1}
          onPress={() => setAbsentAlert(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetHeaderTxt}>
                ⚠️  {absentAlert?.fullName || absentAlert?.name} marked Absent
              </Text>
            </View>
            <View style={styles.sheetBody}>
              {absentAlert?.parentPhone ? (
                <>
                  <View style={styles.sheetRow}>
                    <Text style={styles.sheetRowLbl}>Parent</Text>
                    <Text style={styles.sheetRowVal}>{absentAlert.parentPhone}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.waBtn}
                    onPress={() => sendAbsentWhatsApp(absentAlert)}>
                    <Text style={styles.waBtnTxt}>📱  Send WhatsApp Alert</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={styles.noNumberTxt}>No parent number saved</Text>
              )}
              <TouchableOpacity
                style={styles.skipBtn}
                onPress={() => setAbsentAlert(null)}>
                <Text style={styles.skipBtnTxt}>Skip</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#faf8f2'},
  flex: {flex: 1},

  // Absent WhatsApp alert bottom sheet
  sheetBackdrop: {flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end'},
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 32, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: {width: 0, height: -3},
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 12,
  },
  sheetHeader: {
    backgroundColor: '#0d1f3c', paddingVertical: 18, paddingHorizontal: 20,
  },
  sheetHeaderTxt: {color: '#ffffff', fontSize: 16, fontWeight: '700'},
  sheetBody: {paddingHorizontal: 20, paddingTop: 18},
  sheetRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, marginBottom: 8,
  },
  sheetRowLbl: {fontSize: 13, color: '#8b7355', fontWeight: '500'},
  sheetRowVal: {fontSize: 15, color: '#0d1f3c', fontWeight: '700'},
  waBtn: {
    backgroundColor: '#C9A84C', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginTop: 4,
  },
  waBtnTxt: {color: '#ffffff', fontSize: 15, fontWeight: '700'},
  skipBtn: {
    backgroundColor: '#f3f4f6', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 10,
  },
  skipBtnTxt: {color: '#6b7280', fontSize: 14, fontWeight: '600'},
  noNumberTxt: {
    fontSize: 14, color: '#8b7355', textAlign: 'center', paddingVertical: 12,
  },

  navbar: {
    backgroundColor: '#0d1f3c', paddingTop: 50, paddingBottom: 16,
    paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {fontSize: 20, fontWeight: '700', color: '#ffffff', letterSpacing: 2},
  brandAccent: {color: '#C9A84C'},
  navSub: {fontSize: 9, letterSpacing: 3, color: 'rgba(255,255,255,0.5)'},
  teacherCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#ffffff', padding: 14,
    borderBottomWidth: 1, borderBottomColor: '#ece5d3',
  },
  teacherAv: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#fdf8ee', borderWidth: 2, borderColor: '#B8960A',
    alignItems: 'center', justifyContent: 'center',
  },
  teacherAvTxt: {fontSize: 13, fontWeight: '700', color: '#B8960A'},
  teacherName: {fontSize: 15, fontWeight: '700', color: '#0d1f3c'},
  teacherMeta: {fontSize: 12, color: '#6b7280', marginTop: 1},
  // ── BOTTOM TAB BAR ──
  bottomBar: {backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#ece5d3'},
  bottomBarContent: {paddingHorizontal: 4, paddingVertical: 6},
  bottomTab: {alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 4, gap: 2, minWidth: 70},
  bottomTabTxt: {fontSize: 10, fontWeight: '500', color: '#94a3b8'},
  bottomTabTxtOn: {color: '#B8960A', fontWeight: '700'},
  content: {flex: 1, paddingHorizontal: 14, paddingTop: 14},
  sectionTitle: {fontSize: 17, fontWeight: '700', color: '#0d1f3c', marginBottom: 12},
  noClassTxt: {
    fontSize: 13, color: '#B8960A', fontWeight: '500',
    lineHeight: 19, marginBottom: 12,
  },
  stepHeader: {flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12},
  emptyBox: {alignItems: 'center', paddingVertical: 40, gap: 10},
  emptyTxt: {fontSize: 15, fontWeight: '600', color: '#6b7280'},
  classBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#ffffff', borderRadius: 12, padding: 16,
    marginBottom: 8, borderWidth: 1, borderColor: '#ece5d3',
  },
  classBtnLeft: {flexDirection: 'row', alignItems: 'center', gap: 10},
  classBtnTxt: {fontSize: 15, fontWeight: '600', color: '#0d1f3c'},
  classBtnSub: {fontSize: 11, color: '#16a34a', fontWeight: '500', marginTop: 2},
  testTypeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#ffffff', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1.5, borderColor: '#ece5d3',
  },
  testTypeBtnOn: {borderColor: '#B8960A', backgroundColor: '#fdf8ee'},
  testTypeTxt: {fontSize: 14, fontWeight: '500', color: '#6b7280'},
  testTypeTxtOn: {color: '#B8960A', fontWeight: '700'},
  marksInput: {
    backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#ece5d3',
    borderRadius: 10, padding: 13, fontSize: 16, color: '#0d1f3c',
    fontWeight: '600', marginBottom: 16,
  },
  nextBtn: {
    backgroundColor: '#0d1f3c', borderRadius: 10,
    padding: 15, alignItems: 'center', marginTop: 8,
  },
  nextBtnOff: {backgroundColor: '#9ca3af'},
  nextBtnTxt: {color: '#C9A84C', fontSize: 15, fontWeight: '700'},
  testSummary: {
    backgroundColor: '#fdf8ee', borderRadius: 10, padding: 12,
    marginBottom: 14, borderWidth: 1, borderColor: '#e8d5a3',
  },
  testSummaryTxt: {fontSize: 13, color: '#B8960A', fontWeight: '600'},
  classHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#ffffff', padding: 14,
    borderBottomWidth: 1, borderBottomColor: '#ece5d3',
  },
  backLink: {fontSize: 13, color: '#B8960A', fontWeight: '600'},
  // ── PROGRESS TAB ──
  fieldLabel: {
    fontSize: 11, fontWeight: '700', color: '#6b7280',
    letterSpacing: 0.8, marginBottom: 8,
  },
  progChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8,
    backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#ece5d3',
  },
  progChipOn: {backgroundColor: '#0d1f3c', borderColor: '#0d1f3c'},
  progChipTxt: {fontSize: 12, fontWeight: '600', color: '#6b7280'},
  progChipTxtOn: {color: '#C9A84C'},
  progRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#ffffff', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#ece5d3', marginBottom: 8,
  },
  progEmpty: {
    alignItems: 'center', gap: 10, paddingVertical: 34,
    backgroundColor: '#fdf8ee', borderRadius: 12,
    borderWidth: 1, borderColor: '#ece5d3',
  },
  progEmptyTxt: {fontSize: 13, color: '#B8960A', fontWeight: '500', textAlign: 'center'},
  chartCard: {
    backgroundColor: '#ffffff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#ece5d3', marginBottom: 12,
  },
  chartRow: {flexDirection: 'row', alignItems: 'flex-end', gap: 14},
  chartCol: {alignItems: 'center', width: 62},
  chartPct: {fontSize: 11, fontWeight: '700', color: '#0d1f3c', marginBottom: 4},
  chartTrack: {
    height: 120, width: 26, justifyContent: 'flex-end',
    backgroundColor: '#faf8f2', borderRadius: 6, overflow: 'hidden',
  },
  chartBar: {width: '100%', borderRadius: 6},
  chartLbl: {
    fontSize: 10, fontWeight: '600', color: '#6b7280',
    marginTop: 6, textAlign: 'center',
  },
  chartDate: {fontSize: 9, color: '#b8a88a', marginTop: 2},
  statRow: {flexDirection: 'row', gap: 8, marginBottom: 12},
  statBox: {
    flex: 1, backgroundColor: '#ffffff', borderRadius: 12, paddingVertical: 12,
    borderWidth: 1, borderColor: '#ece5d3', alignItems: 'center',
  },
  statVal: {fontSize: 17, fontWeight: '700'},
  statLbl: {fontSize: 10, color: '#9ca3af', fontWeight: '600', marginTop: 2},
  trendBox: {
    backgroundColor: '#fdf8ee', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#ece5d3', alignItems: 'center', marginBottom: 12,
  },
  trendTxt: {fontSize: 14, fontWeight: '700', color: '#B8960A'},
  noteCard: {
    backgroundColor: '#ffffff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#ece5d3',
  },
  noteTitle: {fontSize: 14, fontWeight: '700', color: '#0d1f3c', marginBottom: 10},
  noteInput: {
    minHeight: 90, borderWidth: 1.5, borderColor: '#ece5d3', borderRadius: 10,
    padding: 11, fontSize: 13, color: '#0d1f3c', backgroundColor: '#fdfcf8',
  },
  noteMeta: {fontSize: 11, color: '#9ca3af', fontStyle: 'italic', marginTop: 8},
  noteSaveBtn: {
    backgroundColor: '#0d1f3c', borderRadius: 10,
    padding: 12, alignItems: 'center', marginTop: 12,
  },
  noteSaveTxt: {color: '#C9A84C', fontSize: 14, fontWeight: '700'},
  // ── CLASS PROGRESS REPORT ──
  classReportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#0d1f3c', borderRadius: 12, padding: 13, marginBottom: 16,
  },
  classReportBtnTxt: {color: '#C9A84C', fontSize: 14, fontWeight: '700'},
  reportBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#ece5d3',
  },
  shareReportBtn: {
    backgroundColor: '#0d1f3c', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 9, minWidth: 130, alignItems: 'center',
  },
  shareReportTxt: {color: '#C9A84C', fontSize: 13, fontWeight: '700'},
  // Solid background so the captured PNG never comes out transparent.
  reportCapture: {backgroundColor: '#faf8f2', paddingTop: 4},
  reportHeader: {
    backgroundColor: '#0d1f3c', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14, marginBottom: 12,
  },
  reportTitle: {fontSize: 17, fontWeight: '700', color: '#ffffff'},
  reportSub: {fontSize: 11, color: '#C9A84C', marginTop: 3},
  repSummaryCard: {
    backgroundColor: '#ffffff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#ece5d3', marginBottom: 14,
  },
  repSummaryTopRow: {alignItems: 'center', marginBottom: 12},
  repSummaryAvgVal: {fontSize: 30, fontWeight: '700', color: '#B8960A'},
  repSummaryAvgLbl: {
    fontSize: 10, fontWeight: '700', color: '#9ca3af', letterSpacing: 1, marginTop: 2,
  },
  repSummaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 7, borderTopWidth: 1, borderTopColor: '#f3f4f6', gap: 10,
  },
  repSummaryLbl: {fontSize: 12, color: '#6b7280', fontWeight: '600'},
  repSummaryVal: {
    fontSize: 12, color: '#0d1f3c', fontWeight: '600', flexShrink: 1, textAlign: 'right',
  },
  rankRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#ffffff', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#ece5d3', marginBottom: 8,
  },
  rankNum: {fontSize: 14, fontWeight: '700', color: '#0d1f3c', minWidth: 42},
  rankNumTop: {color: '#B8960A'},
  rankInfo: {flex: 1},
  rankName: {fontSize: 14, fontWeight: '600', color: '#0d1f3c'},
  rankMeta: {fontSize: 11, color: '#9ca3af', marginTop: 2},
  rankRight: {flexDirection: 'row', alignItems: 'center', gap: 6},
  rankPct: {fontSize: 16, fontWeight: '700', color: '#B8960A'},
  rankTrend: {fontSize: 13},
  noDataRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#faf8f2', borderRadius: 10, padding: 11,
    borderWidth: 1, borderColor: '#ece5d3', marginBottom: 6,
  },
  noDataName: {fontSize: 13, fontWeight: '600', color: '#6b7280'},
  noDataMeta: {fontSize: 11, color: '#9ca3af'},
  reportFooter: {
    fontSize: 10, color: '#b8a88a', textAlign: 'center',
    marginTop: 16, fontWeight: '500',
  },
  className: {fontSize: 16, fontWeight: '700', color: '#0d1f3c'},
  summaryRow: {
    flexDirection: 'row', gap: 8, padding: 12,
    backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#ece5d3',
  },
  summaryCard: {flex: 1, padding: 10, alignItems: 'center', borderRadius: 10, borderWidth: 1},
  bulkRow: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#ece5d3',
  },
  bulkBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 12, borderWidth: 1.5, alignItems: 'center',
  },
  bulkBtnPresent: {backgroundColor: '#f0fdf4', borderColor: '#86efac'},
  bulkBtnAbsent: {backgroundColor: '#fef2f2', borderColor: '#fca5a5'},
  bulkBtnTxt: {fontSize: 13, fontWeight: '700'},
  summaryVal: {fontSize: 22, fontWeight: '700'},
  summaryLbl: {fontSize: 11, color: '#6b7280', fontWeight: '500', marginTop: 2},
  studentRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 10,
  },
  marksRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 10,
  },
  studentAv: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#fdf8ee', borderWidth: 1.5, borderColor: '#e8d5a3',
    alignItems: 'center', justifyContent: 'center',
  },
  avP: {backgroundColor: '#f0fdf4', borderColor: '#86efac'},
  avA: {backgroundColor: '#fef2f2', borderColor: '#fca5a5'},
  avL: {backgroundColor: '#fffbeb', borderColor: '#fcd34d'},
  studentAvTxt: {fontSize: 12, fontWeight: '700', color: '#B8960A'},
  studentInfo: {flex: 1},
  studentName: {fontSize: 13, fontWeight: '600', color: '#0d1f3c'},
  studentRoll: {fontSize: 11, color: '#9ca3af', marginTop: 1},
  btnGroup: {flexDirection: 'row', gap: 5},
  attBtn: {
    width: 34, height: 34, borderRadius: 8, borderWidth: 1.5,
    borderColor: '#e5e7eb', backgroundColor: '#f9fafb',
    alignItems: 'center', justifyContent: 'center',
  },
  attBtnTxt: {fontSize: 12, fontWeight: '500', color: '#9ca3af'},
  marksInputWrap: {flexDirection: 'row', alignItems: 'center', gap: 4},
  marksInputSmall: {
    width: 52, height: 40, borderWidth: 1.5, borderColor: '#ece5d3',
    borderRadius: 8, backgroundColor: '#fdf8ee',
    textAlign: 'center', fontSize: 14, fontWeight: '700', color: '#0d1f3c',
  },
  marksTotal: {fontSize: 13, color: '#9ca3af', fontWeight: '500'},
  marksInputOff: {backgroundColor: '#f3f4f6', borderColor: '#e5e7eb', color: '#9ca3af'},
  absentToggle: {alignItems: 'center', gap: 3, width: 46},
  absentBox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 1.5,
    borderColor: '#d1d5db', backgroundColor: '#ffffff',
    alignItems: 'center', justifyContent: 'center',
  },
  absentBoxOn: {backgroundColor: '#6b7280', borderColor: '#6b7280'},
  absentTick: {fontSize: 12, fontWeight: '700', color: '#ffffff'},
  absentLbl: {fontSize: 9, fontWeight: '600', color: '#9ca3af'},
  absentLblOn: {color: '#4b5563'},
  submitBar: {
    padding: 14, backgroundColor: '#ffffff',
    borderTopWidth: 1, borderTopColor: '#ece5d3',
  },
  submitBtn: {backgroundColor: '#0d1f3c', borderRadius: 12, padding: 15, alignItems: 'center'},
  submitBtnOff: {backgroundColor: '#9ca3af'},
  submitBtnTxt: {color: '#C9A84C', fontSize: 15, fontWeight: '700'},
  successWrap: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30},
  successIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#f0fdf4', borderWidth: 2, borderColor: '#86efac',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  successTitle: {fontSize: 26, fontWeight: '700', color: '#0d1f3c', marginBottom: 8},
  successStats: {
    flexDirection: 'row', gap: 24, backgroundColor: '#ffffff',
    borderRadius: 16, padding: 20, marginBottom: 24,
    borderWidth: 1, borderColor: '#ece5d3',
  },
  sstat: {alignItems: 'center'},
  sstatVal: {fontSize: 28, fontWeight: '700'},
  sstatLbl: {fontSize: 12, color: '#6b7280', fontWeight: '500', marginTop: 2},
  backBtn: {
    backgroundColor: '#0d1f3c', borderRadius: 12,
    padding: 15, width: '100%', alignItems: 'center',
  },
  backBtnTxt: {color: '#C9A84C', fontSize: 15, fontWeight: '700'},
  myClassCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#ffffff', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#ece5d3',
  },
  myClassLeft: {flexDirection: 'row', alignItems: 'center', gap: 12},
  myClassIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#fdf8ee', alignItems: 'center', justifyContent: 'center',
  },
  myClassName: {fontSize: 15, fontWeight: '700', color: '#0d1f3c'},
  myClassSub: {fontSize: 12, color: '#6b7280', marginTop: 2},
  myClassActions: {flexDirection: 'row', gap: 8},
  markBtn: {
    backgroundColor: '#0d1f3c', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  markBtnTxt: {color: '#C9A84C', fontSize: 12, fontWeight: '700'},
  // ── DIARY ──
  diaryLabel: {fontSize: 12, fontWeight: '700', color: '#8b7355', marginBottom: 8, letterSpacing: 0.5},
  diaryTodayBtn: {
    backgroundColor: '#fdf8ee', borderRadius: 10, borderWidth: 1.5, borderColor: '#e8d5a3',
    paddingHorizontal: 16, justifyContent: 'center',
  },
  diaryTodayTxt: {fontSize: 13, fontWeight: '700', color: '#B8960A'},
  diaryDayHint: {fontSize: 12, color: '#9ca3af', marginBottom: 16, marginLeft: 2},
  diaryGenBtn: {
    backgroundColor: '#0d1f3c', borderRadius: 12, padding: 15,
    alignItems: 'center', borderWidth: 1.5, borderColor: '#C9A84C',
  },
  diaryGenTxt: {color: '#C9A84C', fontSize: 15, fontWeight: '700'},
  diarySheet: {
    backgroundColor: '#ffffff', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#ece5d3',
  },
  diarySheetSchool: {
    fontSize: 16, fontWeight: '700', color: '#B8960A',
    textAlign: 'center', letterSpacing: 2,
  },
  diarySheetMeta: {
    fontSize: 12, color: '#4a3728', textAlign: 'center',
    marginTop: 4, marginBottom: 14,
  },
  diaryHeadRow: {
    flexDirection: 'row', backgroundColor: '#0d1f3c',
    borderTopLeftRadius: 8, borderTopRightRadius: 8,
  },
  diaryHeadCell: {
    color: '#C9A84C', fontSize: 12, fontWeight: '700',
    paddingVertical: 9, paddingHorizontal: 10,
  },
  diaryBodyRow: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ece5d3',
    borderLeftWidth: 1, borderRightWidth: 1, borderLeftColor: '#ece5d3', borderRightColor: '#ece5d3',
  },
  diarySubjCell: {
    fontSize: 12, fontWeight: '600', color: '#0d1f3c',
    paddingVertical: 9, paddingHorizontal: 10, backgroundColor: '#fdf8ee',
  },
  diaryTaskCell: {
    fontSize: 12, color: '#4a3728',
    paddingVertical: 9, paddingHorizontal: 10,
  },
  diaryShareBtn: {
    backgroundColor: '#0d1f3c', borderRadius: 10, padding: 13, alignItems: 'center',
  },
  diaryShareTxt: {color: '#C9A84C', fontSize: 13, fontWeight: '700'},
  diaryShareBtnAlt: {
    backgroundColor: '#fdf8ee', borderRadius: 10, padding: 13, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#e8d5a3',
  },
  diaryShareTxtAlt: {color: '#B8960A', fontSize: 13, fontWeight: '700'},
});
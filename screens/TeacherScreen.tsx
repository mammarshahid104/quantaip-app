import React, {useState, useEffect, useRef, useMemo, useCallback} from 'react';
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
  RefreshControl,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import Share from 'react-native-share';
import RNFS from 'react-native-fs';
import {captureRef} from 'react-native-view-shot';
import Svg, {Circle} from 'react-native-svg';
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
import {confirmSignOut} from '../services/signOut';
import {generateClassInsight, ClassInsightStats} from '../services/aiInsight';

const TEST_TYPES = [
  {key: 'weekly', label: 'Weekly Test'},
  {key: 'monthly', label: 'Monthly Test'},
  {key: 'midterm', label: 'Mid Term'},
  {key: 'sendup', label: 'Send Up'},
  {key: 'final', label: 'Final Exam'},
  {key: 'classtest', label: 'Class Test'},
];

// ── CLASS PROGRESS REPORT ──
// Grade bands, applied to a student's *average* percentage across the subject
// (not to any single test). Ordered high → low; the first band whose `min` is
// met wins, so `min: 0` at the end is the catch-all.
const GRADE_BANDS = [
  {key: 'A+', label: 'A+', range: '90-100', color: '#16a34a', min: 90},
  {key: 'A', label: 'A', range: '80-89', color: '#4ade80', min: 80},
  {key: 'B', label: 'B', range: '70-79', color: '#B8960A', min: 70},
  {key: 'C', label: 'C', range: '60-69', color: '#f59e0b', min: 60},
  {key: 'D', label: 'D', range: '40-59', color: '#f97316', min: 40},
  {key: 'F', label: 'Fail', range: '<40', color: '#ef4444', min: 0},
];

const MEDALS = ['🥇', '🥈', '🥉'];

const bandFor = (pct: number) =>
  GRADE_BANDS.find(b => pct >= b.min) || GRADE_BANDS[GRADE_BANDS.length - 1];

// "27/30" — the marks line printed under every percentage in the report.
// Returns '' when there is nothing to total, so callers drop the line rather
// than print a meaningless "0/0".
const marksLabel = (obtained: any, outOf: any) =>
  Number(outOf) > 0 ? `${Number(obtained) || 0}/${Number(outOf)}` : '';

// ── A4 EXPORT GEOMETRY ──
// Pages are laid out at PAGE_W × PAGE_H dp and captured at exactly 2× into a
// 1240×1754 PNG, so the shared image is a high-res A4 document rather than a
// phone screenshot. 877/620 = 1.4145, matching 1754/1240.
const PAGE_W = 620;
const PAGE_H = 877;
const PAGE_PAD = 28;
const CAPTURE_W = PAGE_W * 2;
const CAPTURE_H = PAGE_H * 2;

// Ranked rows are a fixed height on the export pages, so how many fit on a
// list page is arithmetic rather than guesswork — the list can never overflow
// the page, it just rolls onto the next one.
const P_ROW_H = 40;
const P_ROW_GAP = 5;
// Everything on a list page that isn't a row. These match the paddings and
// font sizes in the p* styles below — change one and change the other.
// navy strip + its margin. Three text lines now: title, report/school/date,
// and the test-scope line — 84 was the two-line figure.
const P_HEADER_H = 102;
const P_FOOTER_H = 24;
const P_LIST_TITLE_H = 23;
const P_LIST_SPACE =
  PAGE_H - PAGE_PAD * 2 - P_HEADER_H - P_FOOTER_H - P_LIST_TITLE_H;
const ROWS_PER_PAGE = Math.floor(P_LIST_SPACE / (P_ROW_H + P_ROW_GAP)); // 14

// Doughnut chart. Each band is one <Circle> on a shared ring: strokeDasharray
// draws an arc of the band's length, and strokeDashoffset slides that arc to
// where the previous band ended. rotation="-90" moves 0° from 3 o'clock to
// 12 o'clock so the ring reads clockwise from the top.
function GradeDonut({
  size,
  stroke,
  bands,
  total,
}: {
  size: number;
  stroke: number;
  bands: {color: string; count: number}[];
  total: number;
}) {
  const c = size / 2;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  let consumed = 0;
  const arcs = total > 0 ? bands.filter(b => b.count > 0) : [];

  return (
    <View style={{width: size, height: size, alignItems: 'center', justifyContent: 'center'}}>
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={r} stroke="#f0ece0" strokeWidth={stroke} fill="none" />
        {arcs.map((b, i) => {
          const len = (b.count / total) * circumference;
          // Offsets are written as (circumference - consumed) rather than
          // -consumed: same arc position, but never a negative dashoffset.
          const offset = circumference - consumed;
          consumed += len;
          return (
            <Circle
              key={i}
              cx={c}
              cy={c}
              r={r}
              stroke={b.color}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${len} ${Math.max(0, circumference - len)}`}
              strokeDashoffset={offset}
              rotation={-90}
              originX={c}
              originY={c}
            />
          );
        })}
      </Svg>
      <View style={{position: 'absolute', alignItems: 'center'}}>
        <Text style={{fontSize: size * 0.26, fontWeight: '700', color: '#0d1f3c'}}>
          {total}
        </Text>
        <Text
          style={{
            fontSize: Math.max(8, size * 0.085),
            fontWeight: '600',
            color: '#8b7355',
            letterSpacing: 1,
          }}>
          {total === 1 ? 'STUDENT' : 'STUDENTS'}
        </Text>
      </View>
    </View>
  );
}

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
  // Which tests the progress views cover. Off by default: the report opens on
  // the latest test alone, because "how did the class do on the test I just
  // marked" is the question being asked 90% of the time. Turning it on widens
  // every figure — averages, ranking, chart, trend — back to the full history.
  const [showHistory, setShowHistory] = useState(false);
  const [sharingReport, setSharingReport] = useState(false);
  const [refreshingReport, setRefreshingReport] = useState(false);
  // Export pages are only mounted while a share is in flight; these refs are
  // the capture targets, one per A4 page.
  const [exportPages, setExportPages] = useState<any[]>([]);
  const pageRefs = useRef<any[]>([]);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // AI insight — cached per "class|subject" so re-opening the report costs
  // nothing. Only a first load or a pull-to-refresh calls the API.
  const [insight, setInsight] = useState('');
  const [insightLoading, setInsightLoading] = useState(false);
  const insightCache = useRef<{[key: string]: string}>({});
  // Guard against a slow API reply landing after the teacher has already
  // switched class or subject.
  const progClassRef = useRef(progClass);
  const progSubjectRef = useRef(progSubject);
  progClassRef.current = progClass;
  progSubjectRef.current = progSubject;

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
    setShowHistory(false);
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
    setShowHistory(false);
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

  // A readable name for one mark entry — "Mid Term", "Weekly Test", …
  const testName = (m: any) =>
    m?.typeName || TEST_TYPES.find(t => t.key === m?.testType)?.label || m?.testType || 'Test';

  // The most recent test the *class* sat in this subject. Deliberately taken
  // across every student rather than per-student, so "current test only" ranks
  // everyone on the same paper — a student who was absent for it shows as
  // missing rather than silently being scored on an older test.
  // Absent entries count for identifying the test; they just carry no score.
  const latestTest = useMemo(() => {
    let best: any = null;
    progStudents.forEach(s => {
      Object.values(s?.marksMap || {}).forEach((m: any) => {
        if (m?.subject !== progSubject || !m?.testId) return;
        if (!best || String(m.date || '').localeCompare(String(best.date || '')) > 0) {
          best = m;
        }
      });
    });
    return best
      ? {testId: best.testId as string, date: String(best.date || ''), name: testName(best)}
      : null;
  }, [progStudents, progSubject]);

  // null = every test; a testId = that one test only. Marks saved before
  // testId existed produce no latestTest, so those classes fall back to the
  // old full-history behaviour rather than showing a blank report.
  const scopeTestId = showHistory ? null : latestTest?.testId || null;

  // Chronological test history for one student in one subject. Absent tests are
  // left out entirely — plotting them as 0 would invent a score.
  // `onlyTestId` narrows the whole calculation to a single test, which is what
  // the default "current marks only" view runs on.
  const progressData = (student: any, subject: string, onlyTestId?: string | null) => {
    const entries = Object.values(student?.marksMap || {})
      .filter((m: any) =>
        m.subject === subject && !m.isAbsent &&
        (!onlyTestId || m.testId === onlyTestId))
      .sort((a: any, b: any) => String(a.date || '').localeCompare(String(b.date || ''))) as any[];

    const pcts = entries.map(m => m.percentage || 0);
    const high = pcts.length ? Math.max(...pcts) : 0;
    const low = pcts.length ? Math.min(...pcts) : 0;
    const avg = pcts.length
      ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length)
      : 0;

    // Raw marks aggregated over the same non-absent tests the average is built
    // from, so the "67/75" shown next to a percentage always covers exactly the
    // tests that percentage came from.
    const obtained = entries.reduce((a, m) => a + (Number(m.obtained) || 0), 0);
    const outOf = entries.reduce((a, m) => a + (Number(m.total) || 0), 0);
    // The single test behind the high/low figures, for their own marks line.
    const highEntry = pcts.length ? entries[pcts.indexOf(high)] : null;
    const lowEntry = pcts.length ? entries[pcts.indexOf(low)] : null;

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
      .filter((m: any) =>
        m.subject === subject && m.isAbsent &&
        (!onlyTestId || m.testId === onlyTestId)).length;

    return {
      entries, high, low, avg, trend, trendIcon, trendDiff, absentCount,
      obtained, outOf,
      highMarks: marksLabel(highEntry?.obtained, highEntry?.total),
      lowMarks: marksLabel(lowEntry?.obtained, lowEntry?.total),
    };
  };

  // ── CLASS PROGRESS REPORT ──
  // Same per-student maths as the individual view, run across the whole class
  // and ranked. Students with no recorded test are listed separately rather
  // than ranked at 0%. Memoised because every section of the report screen —
  // and every A4 export page — reads from this one object.
  const rep = useMemo(() => {
    // Denominator for "4/5 tests" — every test the class sat in this subject,
    // or just the current one while history is hidden.
    const allTestIds = new Set<string>();
    progStudents.forEach(s => {
      Object.values(s?.marksMap || {}).forEach((m: any) => {
        if (m.subject !== progSubject || !m.testId) return;
        if (scopeTestId && m.testId !== scopeTestId) return;
        allTestIds.add(m.testId);
      });
    });
    const totalTests = allTestIds.size;

    const rows = progStudents.map(s => {
      const d = progressData(s, progSubject, scopeTestId);
      return {
        student: s,
        name: s.fullName || s.name || 'Unknown',
        rollNo: s.rollNo || '—',
        avg: d.avg,
        obtained: d.obtained,
        outOf: d.outOf,
        marks: marksLabel(d.obtained, d.outOf),
        taken: d.entries.length,
        // Anything the student has no score for — whether explicitly marked
        // absent or simply never recorded.
        missed: Math.max(0, totalTests - d.entries.length),
        absentCount: d.absentCount,
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

    // Class-wide marks total: every ranked student's obtained/out-of summed.
    // Deliberately a straight total of the sittings that happened — students
    // who sat fewer tests contribute less to both sides of the fraction.
    const classMarks = marksLabel(
      ranked.reduce((a, r) => a + r.obtained, 0),
      ranked.reduce((a, r) => a + r.outOf, 0),
    );

    // Sittings, not students: how many student-test slots were actually taken
    // versus missed across the whole class for this subject.
    const presentSittings = ranked.reduce((a, r) => a + r.taken, 0);
    const absentSittings = rows.reduce((a, r) => a + r.missed, 0);

    // Grade distribution over student averages. Students with nothing recorded
    // are left out — a 0-test student is not a Fail, they're unmeasured.
    const distribution = GRADE_BANDS.map(b => {
      const count = ranked.filter(r => bandFor(r.avg).key === b.key).length;
      return {
        ...b,
        count,
        share: ranked.length ? Math.round((count / ranked.length) * 100) : 0,
      };
    });

    // Most improved / needs attention only mean something once a student has
    // enough tests for a trend; otherwise fall back to the lowest average.
    const withTrend = ranked.filter(r => r.trend);
    const mostImproved = withTrend.length
      ? withTrend.reduce((best, r) => (r.trendDiff > best.trendDiff ? r : best))
      : null;

    // A student qualifies on ANY of: failing average, two or more tests with no
    // score, or a declining trend. Reasons are combined into one line, and the
    // worst cases float to the top so the three shown are the three that
    // matter most.
    const attention = rows
      .map(r => {
        const reasons: string[] = [];
        let severity = 0;
        if (r.taken === 0 && totalTests >= 2) {
          reasons.push(`no score in any of ${totalTests} tests`);
          severity += 60;
        } else {
          if (r.avg < 40) {
            reasons.push(`${r.avg}% avg`);
            severity += 100 - r.avg;
          }
          if (r.missed >= 2) {
            reasons.push(`missed ${r.missed} tests`);
            severity += r.missed * 8;
          }
          if (r.trendDiff < -5) {
            reasons.push('declining');
            severity += Math.min(40, Math.abs(Math.round(r.trendDiff)));
          }
        }
        return {...r, reasons, severity};
      })
      .filter(r => r.reasons.length > 0)
      .sort((a, b) => b.severity - a.severity);

    const needsAttention = attention.slice(0, 3).map(r => ({
      ...r,
      // "32% avg, declining" — sentence-cased for the card.
      reason: r.reasons.join(', ').replace(/^./, ch => ch.toUpperCase()),
    }));

    const belowForty = ranked.filter(r => r.avg < 40).length;

    // Class-level direction: the mean of every student's own trend delta.
    const trendDiffAvg = withTrend.length
      ? withTrend.reduce((a, r) => a + r.trendDiff, 0) / withTrend.length
      : 0;
    const classTrend: ClassInsightStats['trend'] =
      trendDiffAvg > 3 ? 'improving' : trendDiffAvg < -3 ? 'declining' : 'steady';

    return {
      ranked,
      noData,
      totalTests,
      classAvg,
      classMarks,
      distribution,
      presentSittings,
      absentSittings,
      belowForty,
      classTrend,
      topPerformers: ranked.slice(0, 3),
      highest: ranked.length ? ranked[0] : null,
      lowest: ranked.length ? ranked[ranked.length - 1] : null,
      mostImproved: mostImproved && mostImproved.trendDiff > 5 ? mostImproved : null,
      needsAttention,
    };
    // progressData is a pure helper over its arguments, so the inputs below are
    // the only things that can change the result.
  }, [progStudents, progSubject, scopeTestId]);

  // Kept in a ref so the insight effect can read the latest figures without
  // re-running every time an unrelated part of the report recomputes.
  const repRef = useRef(rep);
  repRef.current = rep;

  // Fetch (or serve from cache) the AI insight for the current class+subject.
  // force=true is the pull-to-refresh path and bypasses the cache.
  const loadInsight = useCallback(
    async (force: boolean) => {
      const cls = progClass;
      const sub = progSubject;
      if (!cls || !sub) return;

      // Scope is part of the key: the latest-test-only figures and the
      // full-history figures deserve their own insight, not each other's.
      const key = `${cls}|${sub}|${scopeTestId || 'all'}`;
      if (!force && insightCache.current[key]) {
        setInsight(insightCache.current[key]);
        return;
      }

      const current = repRef.current;
      if (current.ranked.length === 0) {
        setInsight('');
        return;
      }

      setInsightLoading(true);
      try {
        const text = await generateClassInsight({
          className: cls,
          subject: sub,
          average: current.classAvg,
          highest: current.highest?.avg || 0,
          lowest: current.lowest?.avg || 0,
          belowForty: current.belowForty,
          studentCount: current.ranked.length,
          testsConducted: current.totalTests,
          trend: current.classTrend,
        });
        insightCache.current[key] = text;
        // The teacher may have navigated on while the request was in flight.
        if (progClassRef.current === cls && progSubjectRef.current === sub) {
          setInsight(text);
        }
      } finally {
        setInsightLoading(false);
      }
    },
    [progClass, progSubject, scopeTestId],
  );

  // Opening the report loads the insight once; the cache keeps every later
  // open free.
  useEffect(() => {
    if (!showClassReport) return;
    loadInsight(false);
  }, [showClassReport, loadInsight]);

  // Pull-to-refresh: re-read the class from Firestore and regenerate the
  // insight against the fresh numbers.
  const refreshReport = async () => {
    setRefreshingReport(true);
    try {
      const snapshot = await firestore()
        .collection('schools').doc(getSchoolCode())
        .collection('students')
        .where('class', '==', progClass)
        .get();
      setProgStudents(snapshot.docs.map(d => d.data()));
      // repRef still holds the previous figures at this point; let the state
      // update land first so the insight is generated from what was just read.
      await new Promise<void>(resolve => setTimeout(() => resolve(), 0));
      await loadInsight(true);
    } catch (e) {
      console.log('❌ QUANTAIP Error:', e);
    } finally {
      setRefreshingReport(false);
    }
  };

  // Export the report as A4-proportioned PNGs and hand them to the share sheet.
  //
  // The pages are laid out off-screen at 620×877 dp and captured at 2× into
  // 1240×1754 images, so what gets shared is a real document page rather than a
  // phone screenshot. Page 1 carries the summary sections (header, stat cards,
  // doughnut, needs-attention, AI insight, top performers); the ranked list
  // then runs across as many further pages as it needs, ROWS_PER_PAGE at a
  // time. Splitting beats shrinking here: row height stays legible for a
  // 35-student class instead of collapsing to fit, and page count is pure
  // arithmetic so the list can never overflow.
  //
  // Deliberately image-based — react-native-html-to-pdf is the library that
  // caused the "Uri.getScheme() on null" crash and stays out.
  const shareClassReport = async () => {
    if (sharingReport) return;
    setSharingReport(true);
    try {
      // Page 1 is the summary; the rest are slices of the ranked list, with
      // the no-data students appended to the final slice.
      const listPages: any[] = [];
      for (let i = 0; i < rep.ranked.length; i += ROWS_PER_PAGE) {
        listPages.push({rows: rep.ranked.slice(i, i + ROWS_PER_PAGE), startAt: i});
      }
      if (listPages.length === 0) listPages.push({rows: [], startAt: 0});

      const pages = [{kind: 'summary'}, ...listPages.map(p => ({kind: 'list', ...p}))];
      pageRefs.current = [];
      setExportPages(pages);

      // Let React commit the off-screen pages and Android lay them out before
      // asking view-shot to draw them.
      await new Promise<void>(resolve => setTimeout(() => resolve(), 450));

      const uris: string[] = [];
      for (let i = 0; i < pages.length; i++) {
        const ref = pageRefs.current[i];
        if (!ref) continue;
        const uri = await captureRef(ref, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
          width: CAPTURE_W,
          height: CAPTURE_H,
        });
        uris.push(uri.startsWith('file://') ? uri : `file://${uri}`);
      }

      if (uris.length === 0) {
        Alert.alert('Error', 'Could not render report.');
        return;
      }

      const title = `Class Report - ${progClass} - ${progSubject}`;
      await Share.open(
        uris.length === 1
          ? {url: uris[0], type: 'image/png', title, failOnCancel: false}
          : {urls: uris, type: 'image/png', title, failOnCancel: false},
      );
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (!msg.includes('User did not share') && !msg.includes('cancel')) {
        console.log('❌ QUANTAIP Error:', e);
        Alert.alert('Error', 'Could not share report.');
      }
    } finally {
      setExportPages([]);
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

  // One line saying exactly which tests the numbers on screen cover, so a
  // percentage is never ambiguous about what it averages.
  const scopeLabel = showHistory
    ? `All tests · ${rep.totalTests} recorded`
    : latestTest
      ? `Current test — ${latestTest.name}${latestTest.date ? ` · ${latestTest.date}` : ''}`
      : 'No tests recorded yet';

  // Report summary cards, shared by the on-screen report and the A4 export so
  // the printed page can never drift from what the teacher just looked at.
  // The last card swaps identity with the scope: a test count only says
  // something once more than one test is in play.
  const sumCards = [
    {lbl: 'CLASS AVERAGE', val: `${rep.classAvg}%`, marks: rep.classMarks, color: '#B8960A', sub: `${rep.ranked.length} student(s)`},
    {lbl: 'HIGHEST', val: rep.highest ? `${rep.highest.avg}%` : '—', marks: rep.highest?.marks, color: '#16a34a', sub: rep.highest?.name || ''},
    {lbl: 'LOWEST', val: rep.lowest ? `${rep.lowest.avg}%` : '—', marks: rep.lowest?.marks, color: '#ef4444', sub: rep.lowest?.name || ''},
    {lbl: 'PRESENT / ABSENT', val: `${rep.presentSittings} / ${rep.absentSittings}`, marks: '', color: '#0d1f3c', sub: 'test sittings'},
    showHistory
      ? {lbl: 'TESTS CONDUCTED', val: `${rep.totalTests}`, marks: '', color: '#0d1f3c', sub: progSubject}
      : {lbl: 'CURRENT TEST', val: latestTest?.name || '—', marks: '', color: '#0d1f3c', sub: latestTest?.date || progSubject},
  ];

  // The same control in all three progress views. The label says what tapping
  // it will do, not what is on screen now.
  const historyToggle = (
    <TouchableOpacity
      style={[styles.histToggle, showHistory && styles.histToggleOn]}
      onPress={() => setShowHistory(!showHistory)}
      activeOpacity={0.8}>
      <ClockIcon size={15} color={showHistory ? '#C9A84C' : '#B8960A'} />
      <Text style={[styles.histToggleTxt, showHistory && styles.histToggleTxtOn]}>
        {showHistory ? 'Show Current Test Only' : 'Show Previous Tests'}
      </Text>
    </TouchableOpacity>
  );

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
        <TouchableOpacity onPress={() => confirmSignOut(navigation)}>
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

                    {historyToggle}
                    <Text style={styles.scopeLine}>{scopeLabel}</Text>

                    <Text style={styles.fieldLabel}>
                      STUDENTS — {progClass} · {progSubject}
                    </Text>
                    {progStudents.map((s, i) => {
                      const {entries, avg, obtained, outOf} =
                        progressData(s, progSubject, scopeTestId);
                      const aggMarks = marksLabel(obtained, outOf);
                      const hasNote = !!s?.teacherNotes?.[progSubject]?.note;
                      const summary =
                        entries.length === 0
                          ? showHistory || !latestTest
                            ? 'No tests yet'
                            : 'No score in current test'
                          : showHistory
                            ? `${entries.length} test(s) · avg ${avg}%`
                            : `${latestTest?.name} · ${avg}%`;
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
                              {summary}
                              {aggMarks ? (
                                <Text style={styles.progRowMarks}> · {aggMarks}</Text>
                              ) : null}
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
              // Scoped figures drive everything on screen; the unscoped set is
              // read only to say how many earlier tests the toggle would add.
              const {entries, high, low, avg, trend, absentCount,
                obtained, outOf, highMarks, lowMarks} =
                progressData(progStudent, progSubject, scopeTestId);
              const allEntries = progressData(progStudent, progSubject).entries;
              const earlierCount = Math.max(0, allEntries.length - entries.length);
              const currentEntry = entries.length ? entries[entries.length - 1] : null;
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

                  {/* Scope control — the graph below is the history view, so
                      this toggle just widens what it plots. */}
                  {historyToggle}
                  <Text style={styles.scopeLine}>
                    {scopeLabel}
                    {!showHistory && earlierCount > 0
                      ? ` · ${earlierCount} earlier test(s) hidden`
                      : ''}
                  </Text>

                  {/* Current test at a glance — the default view. One test, so
                      a chart would be a single bar; the card says it plainer. */}
                  {!showHistory && currentEntry ? (
                    <View style={styles.currentCard}>
                      <Text style={styles.currentLbl}>CURRENT TEST</Text>
                      <Text style={styles.currentName}>{testName(currentEntry)}</Text>
                      <Text style={styles.currentPct}>{currentEntry.percentage || 0}%</Text>
                      {marksLabel(currentEntry.obtained, currentEntry.total) ? (
                        <Text style={styles.currentMarks}>
                          {marksLabel(currentEntry.obtained, currentEntry.total)}
                        </Text>
                      ) : null}
                      <Text style={styles.currentMeta}>
                        Grade {bandFor(currentEntry.percentage || 0).label}
                        {currentEntry.date ? ` · ${currentEntry.date}` : ''}
                      </Text>
                    </View>
                  ) : null}

                  {/* Bar chart — plain Views, heights proportional to percentage */}
                  {entries.length === 0 ? (
                    <View style={styles.progEmpty}>
                      <ChartBarIcon size={34} color="#b8a88a" />
                      <Text style={styles.progEmptyTxt}>
                        {showHistory || !latestTest
                          ? `No marks recorded for ${progSubject} yet.`
                          : `No score in the current test (${latestTest.name}).${
                              earlierCount > 0
                                ? ' Tap "Show Previous Tests" to see earlier results.'
                                : ''
                            }`}
                      </Text>
                    </View>
                  ) : !showHistory ? null : (
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
                                {marksLabel(m.obtained, m.total) ? (
                                  <Text style={styles.chartMarks}>
                                    {marksLabel(m.obtained, m.total)}
                                  </Text>
                                ) : null}
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

                  {/* Summary stats — only meaningful over a history; with one
                      test highest/lowest/average are all the same number. */}
                  {showHistory && entries.length > 0 && (
                    <View style={styles.statRow}>
                      {[
                        // Highest/Lowest quote the single test behind them;
                        // Average quotes the total across every test taken.
                        {label: 'Highest', value: `${high}%`, marks: highMarks, color: '#16a34a'},
                        {label: 'Lowest', value: `${low}%`, marks: lowMarks, color: '#ef4444'},
                        {label: 'Average', value: `${avg}%`, marks: marksLabel(obtained, outOf), color: '#B8960A'},
                      ].map((st, i) => (
                        <View key={i} style={styles.statBox}>
                          <Text style={[styles.statVal, {color: st.color}]}>{st.value}</Text>
                          {st.marks ? (
                            <Text style={styles.statMarks}>{st.marks}</Text>
                          ) : null}
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
          Sections run header → summary cards → grade doughnut → needs
          attention → AI insight → top performers → ranked list → footer.
          The Back/Share bar sits outside the ScrollView; the shared image is
          rendered separately as A4 pages (see the export layer at the bottom
          of this file) rather than being a screenshot of this view. */}
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

          <ScrollView
            style={styles.content}
            refreshControl={
              <RefreshControl
                refreshing={refreshingReport}
                onRefresh={refreshReport}
                colors={['#B8960A']}
                tintColor="#B8960A"
              />
            }>
            {/* 1 — HEADER */}
            <View style={styles.reportHeader}>
              <Text style={styles.reportTitle}>{progClass} — {progSubject}</Text>
              <Text style={styles.reportSub}>
                Class Progress Report · {schoolName || getSchoolCode()} · {today}
              </Text>
              <Text style={styles.reportSub}>
                {rep.ranked.length} student(s) ranked · {rep.totalTests} test(s)
              </Text>
              <Text style={styles.reportScope}>{scopeLabel}</Text>
            </View>

            {/* 1b — TEST SCOPE TOGGLE
                The report opens on the latest test only; this widens every
                figure below it to the full history. */}
            {historyToggle}

            {/* 2 — SUMMARY CARDS */}
            <View style={styles.sumGrid}>
              {sumCards.map((c, i) => (
                <View key={i} style={styles.sumCard}>
                  <Text style={styles.sumLbl}>{c.lbl}</Text>
                  <Text style={[styles.sumVal, {color: c.color}]} numberOfLines={1}>
                    {c.val}
                  </Text>
                  {c.marks ? (
                    <Text style={styles.sumMarks}>{c.marks}</Text>
                  ) : null}
                  {c.sub ? (
                    <Text style={styles.sumSub} numberOfLines={1}>{c.sub}</Text>
                  ) : null}
                </View>
              ))}
            </View>

            {/* 3 — GRADE DISTRIBUTION */}
            {rep.ranked.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Grade Distribution</Text>
                <View style={styles.donutRow}>
                  <GradeDonut
                    size={150}
                    stroke={26}
                    bands={rep.distribution}
                    total={rep.ranked.length}
                  />
                  <View style={styles.legend}>
                    {rep.distribution.filter(b => b.count > 0).map(b => (
                      <View key={b.key} style={styles.legendRow}>
                        <View style={[styles.legendDot, {backgroundColor: b.color}]} />
                        <Text style={styles.legendLbl}>
                          {b.label} <Text style={styles.legendRange}>({b.range})</Text>
                        </Text>
                        <Text style={styles.legendVal}>{b.count} · {b.share}%</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* 4 — NEEDS ATTENTION (hidden entirely when nobody qualifies) */}
            {rep.needsAttention.length > 0 && (
              <View style={styles.attnCard}>
                <Text style={styles.attnTitle}>⚠️ Needs Attention</Text>
                {rep.needsAttention.map((r, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.attnRow}
                    onPress={() => openProgStudent(r.student)}>
                    <View style={{flex: 1}}>
                      <Text style={styles.attnName}>{r.name}</Text>
                      <Text style={styles.attnReason}>{r.reason}</Text>
                    </View>
                    {/* The reason line already carries the percentage, so the
                        right column adds the marks behind it rather than
                        repeating the figure. */}
                    <View style={styles.attnRight}>
                      {r.marks ? (
                        <Text style={styles.attnMarks}>{r.marks}</Text>
                      ) : null}
                      <Text style={styles.attnRoll}>Roll {r.rollNo}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* 5 — AI CLASS INSIGHT */}
            {rep.ranked.length > 0 && (
              <View style={styles.aiCard}>
                <Text style={styles.aiTitle}>✨ AI Class Insight</Text>
                {insightLoading ? (
                  <View style={styles.aiLoading}>
                    <ActivityIndicator size="small" color="#B8960A" />
                    <Text style={styles.aiLoadingTxt}>Reading the class data…</Text>
                  </View>
                ) : (
                  <Text style={styles.aiBody}>{insight || '—'}</Text>
                )}
                <Text style={styles.aiHint}>Pull down to refresh</Text>
              </View>
            )}

            {/* 6 — TOP PERFORMERS */}
            {rep.topPerformers.length > 0 && (
              <>
                <Text style={styles.fieldLabel}>TOP PERFORMERS</Text>
                <View style={styles.podiumRow}>
                  {rep.topPerformers.map((r, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.podiumCard}
                      onPress={() => openProgStudent(r.student)}>
                      <Text style={styles.podiumMedal}>{MEDALS[i]}</Text>
                      <Text style={styles.podiumName} numberOfLines={2}>{r.name}</Text>
                      <Text style={styles.podiumRoll}>Roll {r.rollNo}</Text>
                      <Text style={styles.podiumPct}>{r.avg}%</Text>
                      {r.marks ? (
                        <Text style={styles.podiumMarks}>{r.marks}</Text>
                      ) : null}
                      <Text style={styles.podiumTrend}>{r.trend || '—'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* 7 — RANKED STUDENT LIST */}
            {rep.ranked.length === 0 ? (
              <View style={styles.progEmpty}>
                <ChartBarIcon size={34} color="#b8a88a" />
                <Text style={styles.progEmptyTxt}>
                  No test data recorded for {progSubject} yet.
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.fieldLabel}>CLASS RANKING ({rep.ranked.length})</Text>
                {rep.ranked.map((r, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.rankRow}
                    onPress={() => openProgStudent(r.student)}>
                    <Text style={[styles.rankNum, i < 3 && styles.rankNumTop]}>
                      {MEDALS[i] ? `${MEDALS[i]} ` : ''}{i + 1}.
                    </Text>
                    <View style={styles.rankInfo}>
                      <Text style={styles.rankName}>{r.name}</Text>
                      <Text style={styles.rankMeta}>
                        Roll No: {r.rollNo} · {r.taken}/{rep.totalTests} tests
                      </Text>
                    </View>
                    <View style={styles.rankRight}>
                      <View style={styles.rankScore}>
                        <Text style={styles.rankPct}>{r.avg}%</Text>
                        {r.marks ? (
                          <Text style={styles.rankMarks}>{r.marks}</Text>
                        ) : null}
                      </View>
                      {r.trendIcon ? <Text style={styles.rankTrend}>{r.trendIcon}</Text> : null}
                    </View>
                  </TouchableOpacity>
                ))}
              </>
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

            {/* 8 — FOOTER */}
            <Text style={styles.reportFooter}>
              Generated by QUANTAIP EduOS · {today}
            </Text>
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

      {/* ── A4 EXPORT LAYER ──
          Only mounted while a share is running. Each page is a fixed
          620×877 dp View parked off-screen (not hidden with opacity — an
          opacity-0 view captures blank on Android) and drawn directly by
          captureRef, so what gets shared is a laid-out document page rather
          than whatever happened to be scrolled into view. collapsable={false}
          keeps Android from flattening the page out of the view hierarchy and
          leaving nothing to capture. */}
      {exportPages.length > 0 && (
        <View style={styles.exportLayer} pointerEvents="none">
          {exportPages.map((page, i) => (
            <View
              key={i}
              ref={(el: any) => {
                pageRefs.current[i] = el;
              }}
              collapsable={false}
              style={styles.page}>
              {/* Page header strip — repeated so any single page stands alone
                  if it gets forwarded on its own. */}
              <View style={styles.pHeader}>
                <View style={{flex: 1}}>
                  <Text style={styles.pHeaderTitle}>{progClass} — {progSubject}</Text>
                  <Text style={styles.pHeaderSub}>
                    Class Progress Report · {schoolName || getSchoolCode()} · {today}
                  </Text>
                  {/* Whoever the page is forwarded to has to be able to tell
                      one test from a whole term at a glance. */}
                  <Text style={styles.pHeaderSub}>{scopeLabel}</Text>
                </View>
                <Text style={styles.pHeaderPage}>
                  Page {i + 1} of {exportPages.length}
                </Text>
              </View>

              <View style={styles.pBody}>
                {page.kind === 'summary' ? (
                  <>
                    {/* Summary cards — 3 up, then 2 up */}
                    <View style={styles.pSumGrid}>
                      {sumCards.map((c, k) => (
                        <View key={k} style={styles.pSumCard}>
                          <Text style={styles.pSumLbl}>{c.lbl}</Text>
                          <Text style={[styles.pSumVal, {color: c.color}]} numberOfLines={1}>
                            {c.val}
                          </Text>
                          {c.marks ? (
                            <Text style={styles.pSumMarks}>{c.marks}</Text>
                          ) : null}
                          {c.sub ? (
                            <Text style={styles.pSumSub} numberOfLines={1}>{c.sub}</Text>
                          ) : null}
                        </View>
                      ))}
                    </View>

                    {/* Grade distribution */}
                    <View style={styles.pCard}>
                      <Text style={styles.pCardTitle}>GRADE DISTRIBUTION</Text>
                      <View style={styles.pDonutRow}>
                        <GradeDonut
                          size={132}
                          stroke={24}
                          bands={rep.distribution}
                          total={rep.ranked.length}
                        />
                        <View style={styles.pLegend}>
                          {rep.distribution.filter(b => b.count > 0).map(b => (
                            <View key={b.key} style={styles.pLegendRow}>
                              <View style={[styles.pLegendDot, {backgroundColor: b.color}]} />
                              <Text style={styles.pLegendLbl}>
                                {b.label} <Text style={styles.pLegendRange}>({b.range})</Text>
                              </Text>
                              <Text style={styles.pLegendVal}>{b.count} · {b.share}%</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    </View>

                    {/* Needs attention */}
                    {rep.needsAttention.length > 0 && (
                      <View style={styles.pAttnCard}>
                        <Text style={styles.pAttnTitle}>⚠️ NEEDS ATTENTION</Text>
                        {/* One line each: page 1's height budget assumes at
                            most 3 single-line rows here. */}
                        {rep.needsAttention.map((r, k) => (
                          <Text key={k} style={styles.pAttnRow} numberOfLines={1}>
                            <Text style={styles.pAttnName}>{r.name}</Text>
                            <Text style={styles.pAttnReason}>  — {r.reason}</Text>
                            {r.marks ? (
                              <Text style={styles.pAttnMarks}>  {r.marks}</Text>
                            ) : null}
                          </Text>
                        ))}
                      </View>
                    )}

                    {/* AI insight */}
                    {insight ? (
                      <View style={styles.pAiCard}>
                        <Text style={styles.pAiTitle}>✨ AI CLASS INSIGHT</Text>
                        {/* Capped so a long model reply can't push the top
                            performers off the bottom of the page. */}
                        <Text style={styles.pAiBody} numberOfLines={3}>{insight}</Text>
                      </View>
                    ) : null}

                    {/* Top performers */}
                    {rep.topPerformers.length > 0 && (
                      <View style={styles.pPodiumRow}>
                        {rep.topPerformers.map((r, k) => (
                          <View key={k} style={styles.pPodiumCard}>
                            <Text style={styles.pPodiumMedal}>{MEDALS[k]}</Text>
                            <Text style={styles.pPodiumName} numberOfLines={1}>{r.name}</Text>
                            <Text style={styles.pPodiumRoll}>Roll {r.rollNo}</Text>
                            <Text style={styles.pPodiumPct}>{r.avg}%</Text>
                            {r.marks ? (
                              <Text style={styles.pPodiumMarks}>{r.marks}</Text>
                            ) : null}
                            <Text style={styles.pPodiumTrend}>{r.trend || '—'}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    <Text style={styles.pListTitle}>
                      CLASS RANKING{' '}
                      {exportPages.length > 2
                        ? `(${page.startAt + 1}–${page.startAt + page.rows.length} of ${rep.ranked.length})`
                        : `(${rep.ranked.length})`}
                    </Text>
                    {page.rows.length === 0 ? (
                      <Text style={styles.pEmpty}>
                        No test data recorded for {progSubject} yet.
                      </Text>
                    ) : (
                      page.rows.map((r: any, k: number) => {
                        const rank = page.startAt + k;
                        return (
                          <View key={k} style={styles.pRankRow}>
                            <Text style={[styles.pRankNum, rank < 3 && styles.pRankNumTop]}>
                              {MEDALS[rank] ? `${MEDALS[rank]} ` : ''}{rank + 1}.
                            </Text>
                            <View style={{flex: 1}}>
                              <Text style={styles.pRankName} numberOfLines={1}>{r.name}</Text>
                              <Text style={styles.pRankMeta}>
                                Roll No: {r.rollNo} · {r.taken}/{rep.totalTests} tests
                              </Text>
                            </View>
                            {/* Kept on one line — export rows are a fixed
                                P_ROW_H tall and the pagination maths depends
                                on that height not changing. */}
                            <View style={styles.pRankScore}>
                              <Text style={styles.pRankPct}>{r.avg}%</Text>
                              {r.marks ? (
                                <Text style={styles.pRankMarks}>· {r.marks}</Text>
                              ) : null}
                            </View>
                            <Text style={styles.pRankTrend}>{r.trendIcon || ''}</Text>
                          </View>
                        );
                      })
                    )}

                    {/* No-data students ride along on the last list page */}
                    {i === exportPages.length - 1 && rep.noData.length > 0 && (
                      <View style={{marginTop: 14}}>
                        <Text style={styles.pListTitle}>
                          NO TEST DATA YET ({rep.noData.length})
                        </Text>
                        <Text style={styles.pNoDataTxt}>
                          {rep.noData.map(r => `${r.name} (Roll ${r.rollNo})`).join(' · ')}
                        </Text>
                      </View>
                    )}
                  </>
                )}
              </View>

              <Text style={styles.pFooter}>
                Generated by QUANTAIP EduOS · {today}
              </Text>
            </View>
          ))}
        </View>
      )}
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
  // Test-scope toggle: outlined while showing the current test only, filled
  // navy once the full history is on, so the widened state is obvious.
  histToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#e8d5a3',
    borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, marginBottom: 8,
  },
  histToggleOn: {backgroundColor: '#0d1f3c', borderColor: '#0d1f3c'},
  histToggleTxt: {fontSize: 13, fontWeight: '700', color: '#B8960A'},
  histToggleTxtOn: {color: '#C9A84C'},
  scopeLine: {fontSize: 11, color: '#8a7f6a', marginBottom: 14, textAlign: 'center'},
  // Current-test card — the default single-student view
  currentCard: {
    backgroundColor: '#ffffff', borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: '#ece5d3', alignItems: 'center', marginBottom: 14,
  },
  currentLbl: {fontSize: 10, fontWeight: '700', color: '#9ca3af', letterSpacing: 1.2},
  currentName: {fontSize: 15, fontWeight: '700', color: '#0d1f3c', marginTop: 6},
  currentPct: {fontSize: 44, fontWeight: '700', color: '#B8960A', marginTop: 6},
  currentMarks: {fontSize: 18, fontWeight: '600', color: '#0d1f3c'},
  currentMeta: {fontSize: 12, color: '#8a7f6a', marginTop: 6},
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
  chartCol: {alignItems: 'center', width: 66},
  chartPct: {fontSize: 13, fontWeight: '700', color: '#0d1f3c', marginBottom: 1},
  chartMarks: {fontSize: 11, fontWeight: '600', color: '#4a3728', marginBottom: 3},
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
  statMarks: {fontSize: 14, fontWeight: '600', color: '#0d1f3c', marginTop: 1},
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
  reportHeader: {
    backgroundColor: '#0d1f3c', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14, marginBottom: 12,
  },
  reportTitle: {fontSize: 17, fontWeight: '700', color: '#ffffff'},
  reportSub: {fontSize: 11, color: '#C9A84C', marginTop: 3},
  reportScope: {fontSize: 11, color: '#ffffff', fontWeight: '600', marginTop: 6},
  // Summary cards — 3 across, then the last 2 grow to fill the second row.
  sumGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16},
  sumCard: {
    backgroundColor: '#ffffff', borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: '#ece5d3', flexBasis: '31%', flexGrow: 1,
  },
  sumLbl: {fontSize: 9, fontWeight: '700', color: '#9ca3af', letterSpacing: 0.6},
  sumVal: {fontSize: 20, fontWeight: '700', marginTop: 4},
  // Marks line under every percentage — navy and semi-bold so it reads as a
  // second figure, not as caption text like sumSub.
  sumMarks: {fontSize: 14, fontWeight: '600', color: '#0d1f3c', marginTop: 1},
  sumSub: {fontSize: 10, color: '#b8a88a', marginTop: 2},

  card: {
    backgroundColor: '#ffffff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#ece5d3', marginBottom: 16,
  },
  cardTitle: {fontSize: 14, fontWeight: '700', color: '#0d1f3c', marginBottom: 12},

  // Grade distribution — doughnut left, legend right.
  donutRow: {flexDirection: 'row', alignItems: 'center', gap: 14},
  legend: {flex: 1, gap: 7},
  legendRow: {flexDirection: 'row', alignItems: 'center', gap: 7},
  legendDot: {width: 10, height: 10, borderRadius: 5},
  legendLbl: {fontSize: 11, fontWeight: '600', color: '#0d1f3c', flex: 1},
  legendRange: {fontSize: 10, color: '#9ca3af', fontWeight: '400'},
  legendVal: {fontSize: 10, fontWeight: '700', color: '#4a3728'},

  attnCard: {
    backgroundColor: '#fef2f2', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#fecaca', marginBottom: 16,
  },
  attnTitle: {fontSize: 14, fontWeight: '700', color: '#b91c1c', marginBottom: 10},
  attnRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#ffffff', borderRadius: 10, padding: 10, marginBottom: 6,
  },
  attnName: {fontSize: 13, fontWeight: '700', color: '#0d1f3c'},
  attnReason: {fontSize: 11, color: '#b91c1c', marginTop: 2},
  attnRight: {alignItems: 'flex-end'},
  attnMarks: {fontSize: 14, fontWeight: '600', color: '#0d1f3c'},
  attnRoll: {fontSize: 10, color: '#9ca3af', fontWeight: '600', marginTop: 1},

  aiCard: {
    backgroundColor: '#fdf8ee', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#e8d5a3', marginBottom: 16,
  },
  aiTitle: {
    fontSize: 13, fontWeight: '700', color: '#B8960A',
    letterSpacing: 0.3, marginBottom: 8,
  },
  aiBody: {fontSize: 13, lineHeight: 20, color: '#4a3728'},
  aiLoading: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4},
  aiLoadingTxt: {fontSize: 12, color: '#8b7355'},
  aiHint: {fontSize: 10, color: '#b8a88a', marginTop: 8, fontStyle: 'italic'},

  podiumRow: {flexDirection: 'row', gap: 8, marginBottom: 16},
  podiumCard: {
    flex: 1, backgroundColor: '#ffffff', borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: '#e8d5a3', alignItems: 'center',
  },
  podiumMedal: {fontSize: 22},
  podiumName: {
    fontSize: 12, fontWeight: '700', color: '#0d1f3c',
    textAlign: 'center', marginTop: 4,
  },
  podiumRoll: {fontSize: 10, color: '#9ca3af', marginTop: 1},
  podiumPct: {fontSize: 18, fontWeight: '700', color: '#B8960A', marginTop: 4},
  podiumMarks: {fontSize: 14, fontWeight: '600', color: '#0d1f3c', marginTop: 1},
  podiumTrend: {fontSize: 10, color: '#8b7355', marginTop: 2},

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
  rankScore: {alignItems: 'flex-end'},
  rankPct: {fontSize: 16, fontWeight: '700', color: '#B8960A'},
  rankMarks: {fontSize: 14, fontWeight: '600', color: '#0d1f3c', marginTop: 1},
  rankTrend: {fontSize: 13},
  progRowMarks: {fontSize: 13, fontWeight: '600', color: '#0d1f3c'},
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

  // ── A4 EXPORT PAGES (p* styles) ──
  // Parked far enough left that no page edge can bleed onto the real screen.
  exportLayer: {position: 'absolute', left: -(PAGE_W + 80), top: 0, width: PAGE_W},
  page: {
    width: PAGE_W, height: PAGE_H, padding: PAGE_PAD,
    backgroundColor: '#faf8f2', marginBottom: 20,
  },
  pHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0d1f3c', borderRadius: 12,
    paddingHorizontal: 18, paddingVertical: 12, marginBottom: 16,
  },
  pHeaderTitle: {fontSize: 20, fontWeight: '700', color: '#ffffff'},
  pHeaderSub: {fontSize: 12, color: '#C9A84C', marginTop: 3},
  pHeaderPage: {fontSize: 11, color: '#C9A84C', fontWeight: '600'},
  pBody: {flex: 1},
  pFooter: {
    fontSize: 10, color: '#b8a88a', textAlign: 'center',
    marginTop: 10, fontWeight: '500',
  },

  // Page 1 is a fixed height with no room to grow, so the marks lines added to
  // the summary cards and the podium are paid for by trimming the value font
  // sizes, the card paddings and the doughnut — page 1 nets out slightly
  // shorter than it was without them.
  pSumGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10},
  pSumCard: {
    backgroundColor: '#ffffff', borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: '#ece5d3', flexBasis: '31%', flexGrow: 1,
  },
  pSumLbl: {fontSize: 9, fontWeight: '700', color: '#9ca3af', letterSpacing: 0.6},
  pSumVal: {fontSize: 21, fontWeight: '700', marginTop: 3},
  pSumMarks: {fontSize: 15, fontWeight: '600', color: '#0d1f3c', marginTop: 1},
  pSumSub: {fontSize: 10, color: '#b8a88a', marginTop: 2},

  pCard: {
    backgroundColor: '#ffffff', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#ece5d3', marginBottom: 10,
  },
  pCardTitle: {
    fontSize: 12, fontWeight: '700', color: '#0d1f3c',
    letterSpacing: 0.8, marginBottom: 12,
  },
  pDonutRow: {flexDirection: 'row', alignItems: 'center', gap: 22},
  pLegend: {flex: 1, gap: 8},
  pLegendRow: {flexDirection: 'row', alignItems: 'center', gap: 9},
  pLegendDot: {width: 12, height: 12, borderRadius: 6},
  pLegendLbl: {fontSize: 13, fontWeight: '600', color: '#0d1f3c', flex: 1},
  pLegendRange: {fontSize: 11, color: '#9ca3af', fontWeight: '400'},
  pLegendVal: {fontSize: 12, fontWeight: '700', color: '#4a3728'},

  pAttnCard: {
    backgroundColor: '#fef2f2', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#fecaca', marginBottom: 10,
  },
  pAttnTitle: {
    fontSize: 12, fontWeight: '700', color: '#b91c1c',
    letterSpacing: 0.8, marginBottom: 8,
  },
  pAttnRow: {fontSize: 13, lineHeight: 18, marginTop: 2},
  pAttnName: {fontSize: 13, fontWeight: '700', color: '#0d1f3c'},
  pAttnReason: {fontSize: 12, color: '#b91c1c'},
  pAttnMarks: {fontSize: 13, fontWeight: '600', color: '#0d1f3c'},

  pAiCard: {
    backgroundColor: '#fdf8ee', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#e8d5a3', marginBottom: 10,
  },
  pAiTitle: {
    fontSize: 12, fontWeight: '700', color: '#B8960A',
    letterSpacing: 0.8, marginBottom: 8,
  },
  pAiBody: {fontSize: 13, lineHeight: 18, color: '#4a3728'},

  pPodiumRow: {flexDirection: 'row', gap: 10},
  pPodiumCard: {
    flex: 1, backgroundColor: '#ffffff', borderRadius: 12,
    paddingVertical: 8, paddingHorizontal: 8,
    borderWidth: 1, borderColor: '#e8d5a3', alignItems: 'center',
  },
  pPodiumMedal: {fontSize: 22},
  pPodiumName: {fontSize: 13, fontWeight: '700', color: '#0d1f3c', marginTop: 3},
  pPodiumRoll: {fontSize: 10, color: '#9ca3af', marginTop: 1},
  pPodiumPct: {fontSize: 19, fontWeight: '700', color: '#B8960A', marginTop: 3},
  pPodiumMarks: {fontSize: 15, fontWeight: '600', color: '#0d1f3c', marginTop: 1},
  pPodiumTrend: {fontSize: 10, color: '#8b7355', marginTop: 1},

  pListTitle: {
    fontSize: 12, fontWeight: '700', color: '#8b7355',
    letterSpacing: 1, marginBottom: 10,
  },
  pRankRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    height: P_ROW_H, marginBottom: P_ROW_GAP, paddingHorizontal: 12,
    backgroundColor: '#ffffff', borderRadius: 10,
    borderWidth: 1, borderColor: '#ece5d3',
  },
  pRankNum: {fontSize: 14, fontWeight: '700', color: '#0d1f3c', width: 52},
  pRankNumTop: {color: '#B8960A'},
  pRankName: {fontSize: 14, fontWeight: '600', color: '#0d1f3c'},
  pRankMeta: {fontSize: 11, color: '#9ca3af', marginTop: 1},
  pRankScore: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end',
    gap: 6, width: 140,
  },
  pRankPct: {fontSize: 16, fontWeight: '700', color: '#B8960A'},
  pRankMarks: {fontSize: 14, fontWeight: '600', color: '#0d1f3c'},
  pRankTrend: {fontSize: 14, width: 20, textAlign: 'center'},
  pEmpty: {fontSize: 13, color: '#8b7355', textAlign: 'center', marginTop: 30},
  pNoDataTxt: {fontSize: 12, color: '#8b7355', lineHeight: 18},
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
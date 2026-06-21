import React, {useState, useEffect} from 'react';
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
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import firebase from '@react-native-firebase/app';

// ============ SECONDARY APP — ACCOUNT FACTORY ============
// Masla: createUserWithEmailAndPassword naya account bana kar
// USI mein login kar deta hai (admin ka session urr jata hai!)
// Hal: ek alag "secondary" Firebase instance — naya user wahan
// banta hai, admin ka asli session mehfooz rehta hai.
const createAuthAccount = async (email: string, pass: string) => {
  let secondary;
  try {
    secondary = firebase.app('USER_CREATOR');
  } catch (e) {
    secondary = await firebase.initializeApp(firebase.app().options, 'USER_CREATOR');
  }
  await secondary.auth().createUserWithEmailAndPassword(email, pass);
  await secondary.auth().signOut();
};
import {pick, types} from '@react-native-documents/picker';
import * as XLSX from 'xlsx';
import {
  HomeIcon,
  AcademicCapIcon,
  UserGroupIcon,
  UserIcon,
  BanknotesIcon,
  ArrowUpTrayIcon,
  PlusCircleIcon,
  ArrowRightOnRectangleIcon,
  BuildingLibraryIcon,
  ChartBarIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  KeyIcon,
  PencilSquareIcon,
  TrophyIcon,
  CalendarDaysIcon,
  DocumentDuplicateIcon,
} from 'react-native-heroicons/outline';
import ClassesScreen from './ClassesScreen';
import FeeScreen from './FeeScreen';

import {SCHOOL_CODE} from '../config';
import {theme} from '../theme';

const CLASS_HIERARCHY = [
  {category: 'Early Education', classes: ['Nursery', 'Prep', 'KG']},
  {category: 'Primary', classes: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5']},
  {category: 'Middle', classes: ['Grade 6', 'Grade 7', 'Grade 8']},
  {category: 'Secondary', classes: ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12']},
];

const ALL_CLASSES = CLASS_HIERARCHY.flatMap(c => c.classes);

// School code resolver — derive from the logged-in user's email
// (e.g. ghs-001-adm-001@quantaip.edu.pk → "GHS-001"). Falls back to
// the hard-coded SCHOOL_CODE if the email can't be parsed.
const getSchoolCode = (): string => {
  const email = auth().currentUser?.email || '';
  const localPart = email.split('@')[0]; // ghs-001-adm-001
  const segs = localPart.split('-');
  if (segs.length >= 2 && segs[0] && segs[1]) {
    return `${segs[0]}-${segs[1]}`.toUpperCase(); // GHS-001
  }
  return SCHOOL_CODE;
};

const generateId = (role: string, index: number): string => {
  const roleCode: any = {teacher: 'TCH', student: 'STU', parent: 'PAR'};
  const num = String(index).padStart(4, '0');
  return `${SCHOOL_CODE}-${roleCode[role]}-${num}`;
};

const generatePass = (name: string): string => {
  const first = name.split(' ')[0];
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `${first}${num}`;
};

const TABS = [
  {key: 'Dashboard', icon: HomeIcon},
  {key: 'Classes', icon: BuildingLibraryIcon},
  {key: 'Students', icon: UserGroupIcon},
  {key: 'Teachers', icon: AcademicCapIcon},
  {key: 'Fee', icon: BanknotesIcon},
  {key: 'Results', icon: TrophyIcon},
  {key: 'Timetable', icon: CalendarDaysIcon},
  {key: 'Reports', icon: ChartBarIcon},
  {key: 'Import', icon: ArrowUpTrayIcon},
];

// ============ REPORTS HELPERS ============
// Pichle 6 mahine ki list banao (current month pehle)
const getLast6Months = (): {label: string; prefix: string}[] => {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleString('default', {month: 'short', year: 'numeric'});
    const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({label, prefix});
  }
  return months;
};

// attendanceMap se ek mahine ki stats nikalo
// Late (L) = Present ke barabar count hota hai percentage mein
const calcMonthStats = (attendanceMap: any, monthPrefix: string) => {
  let present = 0, absent = 0, late = 0;
  Object.keys(attendanceMap || {}).forEach(date => {
    if (!date.startsWith(monthPrefix)) return;
    const s = attendanceMap[date];
    if (s === 'P') present++;
    else if (s === 'A') absent++;
    else if (s === 'L') late++;
  });
  const total = present + absent + late;
  const pct = total > 0 ? Math.round(((present + late) / total) * 100) : -1;
  return {present, absent, late, total, pct};
};

// ============ TIMETABLE CONSTANTS ============
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Default day template: 7 periods + 1 break
// Friday = half day, chote periods (Jumma ki wajah se)
const makeDefaultDay = (isFriday: boolean) => {
  if (isFriday) {
    return [
      {period: 1, subject: '', teacher: '', time: '8:00 - 8:30'},
      {period: 2, subject: '', teacher: '', time: '8:30 - 9:00'},
      {period: 3, subject: '', teacher: '', time: '9:00 - 9:30'},
      {period: 0, subject: 'BREAK', teacher: '', time: '9:30 - 9:50'},
      {period: 4, subject: '', teacher: '', time: '9:50 - 10:20'},
      {period: 5, subject: '', teacher: '', time: '10:20 - 10:50'},
      {period: 6, subject: '', teacher: '', time: '10:50 - 11:20'},
      {period: 7, subject: '', teacher: '', time: '11:20 - 11:50'},
    ];
  }
  return [
    {period: 1, subject: '', teacher: '', time: '8:00 - 8:40'},
    {period: 2, subject: '', teacher: '', time: '8:40 - 9:20'},
    {period: 3, subject: '', teacher: '', time: '9:20 - 10:00'},
    {period: 0, subject: 'BREAK', teacher: '', time: '10:00 - 10:30'},
    {period: 4, subject: '', teacher: '', time: '10:30 - 11:10'},
    {period: 5, subject: '', teacher: '', time: '11:10 - 11:50'},
    {period: 6, subject: '', teacher: '', time: '11:50 - 12:30'},
    {period: 7, subject: '', teacher: '', time: '12:30 - 1:10'},
  ];
};

const makeDefaultWeek = () => {
  const week: any = {};
  DAYS.forEach(d => {
    week[d] = makeDefaultDay(d === 'Friday');
  });
  return week;
};

export default function AdminScreen({navigation}: any) {
  const [tab, setTab] = useState('Dashboard');
  const [loading, setLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState('');
  const [importProgress, setImportProgress] = useState('');
  const [stats, setStats] = useState({students: 0, teachers: 0, fee: '0'});

  // Student list
  const [studentList, setStudentList] = useState<any[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [credModal, setCredModal] = useState<any>(null);

  // Teacher list
  const [teacherList, setTeacherList] = useState<any[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [teacherModal, setTeacherModal] = useState<any>(null);
  const [editClassesModal, setEditClassesModal] = useState<any>(null);
  const [savingClasses, setSavingClasses] = useState(false);

  // Results states
  const [resultTestType, setResultTestType] = useState('');
  const [resultClass, setResultClass] = useState('');
  const [generatingResult, setGeneratingResult] = useState(false);
  const [resultPreview, setResultPreview] = useState<any[]>([]);
  
  // Student sub tab
  const [studentTab, setStudentTab] = useState('List');
  const [teacherTab, setTeacherTab] = useState('List');

  // Timetable states
  const [ttClass, setTtClass] = useState('');
  const [ttDay, setTtDay] = useState('Monday');
  const [ttData, setTtData] = useState<any>(null);
  const [loadingTT, setLoadingTT] = useState(false);
  const [savingTT, setSavingTT] = useState(false);

  // Reports states
  const MONTH_LIST = getLast6Months();
  const [reportMonth, setReportMonth] = useState(MONTH_LIST[0].prefix);
  const [reportStudents, setReportStudents] = useState<any[]>([]);
  const [reportTeachers, setReportTeachers] = useState<any[]>([]);
  const [loadingReport, setLoadingReport] = useState(false);
  // teacherAttendance: {teacherId: 'P'|'A'} — aaj ki haazri
  const [teacherAtt, setTeacherAtt] = useState<{[id: string]: string}>({});
  const [savingTeacherAtt, setSavingTeacherAtt] = useState(false);

  // ============ TIMETABLE FUNCTIONS ============
  const loadTimetable = async (cls: string) => {
    setTtClass(cls);
    setTtDay('Monday');
    setLoadingTT(true);
    try {
      const doc = await firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('timetable').doc(cls)
        .get();
      const data = doc.data();
      setTtData(data && data.Monday ? data : makeDefaultWeek());
    } catch (e) {
      console.log('❌ QUANTAIP Error:', e);
      setTtData(makeDefaultWeek());
    } finally {
      setLoadingTT(false);
    }
  };

  const updateTTSlot = (index: number, field: string, value: string) => {
    setTtData((prev: any) => {
      const copy = {...prev};
      const daySlots = [...copy[ttDay]];
      daySlots[index] = {...daySlots[index], [field]: value};
      copy[ttDay] = daySlots;
      return copy;
    });
  };

  const copyTTDayToOthers = () => {
    Alert.alert(
      'Copy Day',
      `Copy ${ttDay}'s timetable to all other days? (Friday keeps its shorter timings.)`,
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Copy', onPress: () => {
          setTtData((prev: any) => {
            const copy = {...prev};
            const source = copy[ttDay];
            DAYS.forEach(d => {
              if (d === ttDay) return;
              if (d === 'Friday') {
                // Friday: subjects/teachers copy, times Friday wale (chote) rakhe
                const fridayTimes = makeDefaultDay(true);
                copy[d] = source.map((slot: any, i: number) => ({
                  ...slot,
                  time: fridayTimes[i]?.time || slot.time,
                }));
              } else {
                copy[d] = source.map((slot: any) => ({...slot}));
              }
            });
            return copy;
          });
          Alert.alert('Done ✅', `${ttDay} copied to all days!`);
        }},
      ],
    );
  };

  const saveTimetable = async () => {
    if (!ttClass || !ttData) return;
    setSavingTT(true);
    try {
      await firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('timetable').doc(ttClass)
        .set(ttData);
      Alert.alert('Saved ✅', `${ttClass} timetable saved!`);
    } catch (e) {
      console.log('❌ QUANTAIP Error:', e);
      Alert.alert('Error', 'Could not save timetable. Please try again.');
    } finally {
      setSavingTT(false);
    }
  };

  // Add Student form
  const [sName, setSName] = useState('');
  const [sFatherName, setSFatherName] = useState('');
  const [sSection, setSSection] = useState('');
  const [sRollNo, setSRollNo] = useState('');
  const [sDob, setSdob] = useState('');
  const [sParentPhone, setSParentPhone] = useState('');

  // Add Teacher form
  const [tName, setTName] = useState('');
  const [tSubject, setTSubject] = useState('');
  const [tPhone, setTPhone] = useState('');
  const [tClasses, setTClasses] = useState('');

  useEffect(() => {loadStats();}, []);

  const loadStats = async () => {
    // Each stat loads independently — a failure in one (e.g. the fee
    // sub-query) must NOT zero out the others. Previously a single
    // Promise.all meant any one rejection left every stat at 0.
    const schoolCode = getSchoolCode();
    const schoolRef = firestore().collection('schools').doc(schoolCode);
    console.log('📊 QUANTAIP loadStats — schoolCode:', schoolCode);

    // Students count
    try {
      const sSnap = await schoolRef.collection('students').get();
      console.log('📊 QUANTAIP students fetched:', sSnap.size);
      setStats(prev => ({...prev, students: sSnap.size}));
    } catch (e) {console.log('❌ QUANTAIP students count error:', e);}

    // Teachers count
    try {
      const tSnap = await schoolRef.collection('teachers').get();
      console.log('📊 QUANTAIP teachers fetched:', tSnap.size);
      setStats(prev => ({...prev, teachers: tSnap.size}));
    } catch (e) {console.log('❌ QUANTAIP teachers count error:', e);}

    // Fees collected this month
    try {
      const month = new Date().toLocaleString('default', {month: 'long', year: 'numeric'});
      const feeSnap = await schoolRef.collection('fees').doc(month)
        .collection('students').where('status', '==', 'paid').get();
      let totalFee = 0;
      feeSnap.docs.forEach(d => {totalFee += d.data().amount || 0;});
      const feeFormatted = totalFee >= 1000000
        ? `${(totalFee / 1000000).toFixed(1)}M`
        : totalFee >= 1000
        ? `${(totalFee / 1000).toFixed(0)}K`
        : totalFee.toString();
      console.log('📊 QUANTAIP fees collected:', totalFee);
      setStats(prev => ({...prev, fee: feeFormatted}));
    } catch (e) {console.log('❌ QUANTAIP fee count error:', e);}
  };

  const loadStudents = async () => {
    setLoadingStudents(true);
    try {
      const snap = await firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('students').get();
      setStudentList(snap.docs.map(d => d.data()));
    } catch (e) {console.log('❌ QUANTAIP Error:', e);} finally {setLoadingStudents(false);}
  };

  const loadTeachers = async () => {
    setLoadingTeachers(true);
    try {
      const snap = await firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('teachers').get();
      setTeacherList(snap.docs.map(d => d.data()));
    } catch (e) {console.log('❌ QUANTAIP Error:', e);} finally {setLoadingTeachers(false);}
  };

  useEffect(() => {
    if (tab === 'Students') loadStudents();
    if (tab === 'Teachers') loadTeachers();
    if (tab === 'Reports') loadReportData();
  }, [tab]);

  // ============ REPORTS FUNCTIONS ============
  const loadReportData = async () => {
    setLoadingReport(true);
    try {
      // Ek baar students aur teachers dono load karo
      const [sSnap, tSnap] = await Promise.all([
        firestore().collection('schools').doc(SCHOOL_CODE).collection('students').get(),
        firestore().collection('schools').doc(SCHOOL_CODE).collection('teachers').get(),
      ]);
      setReportStudents(sSnap.docs.map(d => d.data()));
      setReportTeachers(tSnap.docs.map(d => d.data()));
    } catch (e) {
      console.log('❌ QUANTAIP Error:', e);
    } finally {
      setLoadingReport(false);
    }
  };

  const saveTeacherAttendance = async () => {
    const dateKey = new Date().toISOString().split('T')[0];
    const unmarked = reportTeachers.filter(t => !teacherAtt[t.id]);
    if (unmarked.length > 0) {
      Alert.alert('Incomplete', `${unmarked.length} teacher(s) not marked yet.`);
      return;
    }
    setSavingTeacherAtt(true);
    try {
      const batch = firestore().batch();
      reportTeachers.forEach(t => {
        const status = teacherAtt[t.id];
        if (!status) return;
        const ref = firestore()
          .collection('schools').doc(SCHOOL_CODE)
          .collection('teachers').doc(t.id);
        batch.set(ref, {attendanceMap: {[dateKey]: status}}, {merge: true});
      });
      await batch.commit();
      Alert.alert('Saved ✅', 'Teacher attendance recorded for today.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingTeacherAtt(false);
    }
  };

  const STAT_CARDS = [
    {val: stats.students.toString(), lbl: 'Students', color: theme.colors.navy, Icon: UserGroupIcon},
    {val: stats.teachers.toString(), lbl: 'Teachers', color: '#0284c7', Icon: AcademicCapIcon},
    {val: '91%', lbl: 'Attendance', color: '#16a34a', Icon: ChartBarIcon},
    {val: stats.fee, lbl: 'PKR Fees', color: '#ea580c', Icon: BanknotesIcon},
  ];

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const toggleClassForTeacher = (cls: string) => {
    if (!editClassesModal) return;
    const current = editClassesModal.classesAssigned || [];
    const updated = current.includes(cls)
      ? current.filter((c: string) => c !== cls)
      : [...current, cls];
    setEditClassesModal({...editClassesModal, classesAssigned: updated});
  };

  const saveTeacherClasses = async () => {
    if (!editClassesModal) return;
    setSavingClasses(true);
    try {
      await firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('teachers').doc(editClassesModal.id)
        .update({
          classesAssigned: editClassesModal.classesAssigned || [],
        });

      // Update local list
      setTeacherList(prev => prev.map(t =>
        t.id === editClassesModal.id
          ? {...t, classesAssigned: editClassesModal.classesAssigned}
          : t
      ));

      Alert.alert('✅ Saved!', `Classes updated for ${editClassesModal.name}`);
      setEditClassesModal(null);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingClasses(false);
    }
  };
  
  const generateResult = async () => {
  if (!resultTestType || !resultClass) {
    Alert.alert('Error', 'Please select test type and class');
    return;
  }
  setGeneratingResult(true);
  try {
    // Get all marks for this test type and class
    const marksSnap = await firestore()
      .collection('schools').doc(SCHOOL_CODE)
      .collection('marks')
      .where('type', '==', resultTestType)
      .where('class', '==', resultClass)
      .get();

    if (marksSnap.empty) {
      Alert.alert('No Data', 'No marks found for this test type and class!');
      setGeneratingResult(false);
      return;
    }

    // Get all students in this class
    const studentsSnap = await firestore()
      .collection('schools').doc(SCHOOL_CODE)
      .collection('students')
      .where('class', '==', resultClass)
      .get();

    const studentList = studentsSnap.docs.map(d => d.data());

    // For each student — compile all subject marks
    const studentResults: any[] = [];

    for (const student of studentList) {
      let totalObtained = 0;
      let totalMarks = 0;
      const subjects: any = {};

      for (const testDoc of marksSnap.docs) {
        const testData = testDoc.data();
        const studentMarkDoc = await firestore()
          .collection('schools').doc(SCHOOL_CODE)
          .collection('marks').doc(testDoc.id)
          .collection('students').doc(student.id)
          .get();

        const markData = studentMarkDoc.data();
        if (markData) {
          subjects[testData.subject] = {
            obtained: markData?.obtained || 0,
            total: testData.totalMarks,
            percentage: markData?.percentage || 0,
            grade: markData?.grade || 'F',
          };
          totalObtained += markData?.obtained || 0;
          totalMarks += testData.totalMarks;
        }
      }

      if (Object.keys(subjects).length > 0) {
        const percentage = totalMarks > 0 ? Math.round((totalObtained / totalMarks) * 100) : 0;
        const grade = percentage >= 90 ? 'A+' : percentage >= 80 ? 'A' :
          percentage >= 70 ? 'B+' : percentage >= 60 ? 'B' :
          percentage >= 50 ? 'C' : 'F';

        studentResults.push({
          studentId: student.id,
          name: student.fullName || student.name,
          rollNo: student.rollNo,
          class: resultClass,
          section: student.section,
          subjects,
          totalObtained,
          totalMarks,
          percentage,
          grade,
        });
      }
    }

    // Sort by percentage — assign positions
    studentResults.sort((a, b) => b.percentage - a.percentage);
    studentResults.forEach((s, i) => {s.position = i + 1;});

    // Save to Firestore
    const resultId = `${resultTestType}_${resultClass.replace(/\s+/g, '')}_${new Date().toISOString().split('T')[0]}`;
    const batch = firestore().batch();

    studentResults.forEach(s => {
      const ref = firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('results').doc(resultId)
        .collection('students').doc(s.studentId);
      batch.set(ref, {...s, generatedAt: firestore.FieldValue.serverTimestamp()});
      // DUAL-WRITE: student ke apne doc mein bhi result save karo (1-read pattern)
      const sRef = firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('students').doc(s.studentId);
      batch.set(sRef, {
        resultsMap: {[resultId]: {
          ...s,
          resultId,
          testType: resultTestType,
          class: resultClass,
          generatedDate: new Date().toISOString().split('T')[0],
        }},
      }, {merge: true});
    });

    // Save result metadata
    const resultRef = firestore()
      .collection('schools').doc(SCHOOL_CODE)
      .collection('results').doc(resultId);
    batch.set(resultRef, {
      id: resultId,
      testType: resultTestType,
      class: resultClass,
      totalStudents: studentResults.length,
      generatedAt: firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();
    setResultPreview(studentResults);
    Alert.alert('✅ Result Generated!', `${studentResults.length} students ranked for ${resultClass}!`);
  } catch (e: any) {
    Alert.alert('Error', e.message);
  } finally {
    setGeneratingResult(false);
  }
};

  const addStudent = async () => {
    if (!sName || !selectedClass || !sSection) {
      Alert.alert('Error', 'Name, Class and Section are required');
      return;
    }
    setLoading(true);
    try {
      const snapshot = await firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('students').get();

      const index = snapshot.size + 1;
      const studentId = generateId('student', index);
      const parentId = generateId('parent', index);
      const studentPass = generatePass(sName);
      const parentPass = generatePass(sName + ' Parent');

      await firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('students').doc(studentId)
        .set({
          id: studentId, fullName: sName, fatherName: sFatherName,
          class: selectedClass, section: sSection, rollNo: sRollNo,
          dob: sDob, parentPhone: sParentPhone, parentId,
          password: studentPass, role: 'student',
          school: SCHOOL_CODE, status: 'active',
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

      await firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('parents').doc(parentId)
        .set({
          id: parentId, studentId, studentName: sName,
          phone: sParentPhone, password: parentPass,
          role: 'parent', school: SCHOOL_CODE,
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

      await createAuthAccount(
        `${studentId.toLowerCase()}@quantaip.edu.pk`, studentPass);
      await createAuthAccount(
        `${parentId.toLowerCase()}@quantaip.edu.pk`, parentPass);

      setStats(prev => ({...prev, students: prev.students + 1}));
      Alert.alert('Student Added ✅',
        `STUDENT\nID: ${studentId}\nPassword: ${studentPass}\n\nPARENT\nID: ${parentId}\nPassword: ${parentPass}`);

      setSName(''); setSFatherName(''); setSSection('');
      setSRollNo(''); setSdob(''); setSParentPhone('');
      setSelectedClass('');
      loadStudents();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {setLoading(false);}
  };

  const addTeacher = async () => {
    if (!tName || !tSubject) {
      Alert.alert('Error', 'Name and Subject are required');
      return;
    }
    setLoading(true);
    try {
      const snapshot = await firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('teachers').get();

      const index = snapshot.size + 1;
      const teacherId = generateId('teacher', index);
      const defaultPass = generatePass(tName);

      await firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('teachers').doc(teacherId)
        .set({
          id: teacherId, name: tName, subject: tSubject,
          phone: tPhone,
          classesAssigned: tClasses.split(',').map((c: string) => c.trim()).filter(Boolean),
          password: defaultPass, role: 'teacher',
          school: SCHOOL_CODE,
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

      await createAuthAccount(
        `${teacherId.toLowerCase()}@quantaip.edu.pk`, defaultPass);

      setStats(prev => ({...prev, teachers: prev.teachers + 1}));
      Alert.alert('Teacher Added ✅', `ID: ${teacherId}\nPassword: ${defaultPass}`);

      setTName(''); setTSubject(''); setTPhone(''); setTClasses('');
      loadTeachers();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {setLoading(false);}
  };

  const importFromExcel = async () => {
    try {
      setImportProgress('Opening file picker...');
      const [result] = await pick({
        allowMultiSelection: false,
        type: [types.xlsx, types.xls],
      });

      setImportProgress('Reading Excel file...');
      const response = await fetch(result.uri);
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, {type: 'array'});

      let totalSuccess = 0;
      let totalError = 0;

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const data: any[] = XLSX.utils.sheet_to_json(sheet);
        if (data.length === 0) continue;

        setImportProgress(`Importing ${sheetName}... (${data.length} rows)`);
        const isTeacher = sheetName.toLowerCase().includes('teacher');
        const collection = isTeacher ? 'teachers' : 'students';

        const snapshot = await firestore()
          .collection('schools').doc(SCHOOL_CODE)
          .collection(collection).get();

        let currentIndex = snapshot.size;

        for (const row of data) {
          try {
            currentIndex++;
            const name = row['Name'] || row['name'] || '';
            if (!name) continue;
            const defaultPass = generatePass(name);

            if (isTeacher) {
              const teacherId = generateId('teacher', currentIndex);
              await firestore()
                .collection('schools').doc(SCHOOL_CODE)
                .collection('teachers').doc(teacherId)
                .set({
                  id: teacherId, name,
                  subject: row['Subject'] || '',
                  phone: row['Phone'] || '',
                  classesAssigned: (row['Classes Assigned'] || '').split(',').map((c: string) => c.trim()).filter(Boolean),
                  password: defaultPass, role: 'teacher',
                  school: SCHOOL_CODE,
                  createdAt: firestore.FieldValue.serverTimestamp(),
                });
              await createAuthAccount(
                `${teacherId.toLowerCase()}@quantaip.edu.pk`, defaultPass);
            } else {
              const studentId = generateId('student', currentIndex);
              const parentId = generateId('parent', currentIndex);
              const parentPass = generatePass(name + ' Parent');

              await firestore()
                .collection('schools').doc(SCHOOL_CODE)
                .collection('students').doc(studentId)
                .set({
                  id: studentId, fullName: name,
                  fatherName: row['Father Name'] || '',
                  class: sheetName,
                  section: row['Section'] || 'A',
                  rollNo: row['Roll No'] || '',
                  parentPhone: row['Parent Phone'] || '',
                  parentId, password: defaultPass,
                  role: 'student', school: SCHOOL_CODE,
                  status: 'active',
                  createdAt: firestore.FieldValue.serverTimestamp(),
                });

              await firestore()
                .collection('schools').doc(SCHOOL_CODE)
                .collection('parents').doc(parentId)
                .set({
                  id: parentId, studentId, studentName: name,
                  phone: row['Parent Phone'] || '',
                  password: parentPass, role: 'parent',
                  school: SCHOOL_CODE,
                  createdAt: firestore.FieldValue.serverTimestamp(),
                });

              await createAuthAccount(
                `${studentId.toLowerCase()}@quantaip.edu.pk`, defaultPass);
              await createAuthAccount(
                `${parentId.toLowerCase()}@quantaip.edu.pk`, parentPass);
            }
            totalSuccess++;
            setImportProgress(`Importing... ${totalSuccess} done`);
          } catch (e) {totalError++;}
        }
      }

      setImportProgress(`Done! ${totalSuccess} imported, ${totalError} errors.`);
      Alert.alert('Import Complete ✅', `${totalSuccess} records imported!\n${totalError} errors.`);
      loadStats();
    } catch (e: any) {
      setImportProgress('');
      if (e?.code !== 'OPERATION_CANCELED') Alert.alert('Error', e.message);
    }
  };

  const downloadTemplate = async () => {
    try {
      const RNBlobUtil = require('react-native-blob-util').default;
      const wb = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['Name', 'Subject', 'Phone', 'Classes Assigned'],
        ['Mr. Qaiser', 'Mathematics', '0300-1234567', 'Grade 9, Grade 10'],
      ]), 'Teachers');

      const classData = [
        ['Name', 'Father Name', 'Section', 'Roll No', 'Parent Phone'],
        ['Ayesha Khan', 'Mr. Khan', 'A', '001', '0300-1234567'],
      ];
      CLASS_HIERARCHY.flatMap(c => c.classes).forEach(cls => {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(classData), cls);
      });

      const wbout = XLSX.write(wb, {type: 'base64', bookType: 'xlsx'});
      const path = `${RNBlobUtil.fs.dirs.CacheDir}/QUANTAIP_Template.xlsx`;
      await RNBlobUtil.fs.writeFile(path, wbout, 'base64');
      await RNBlobUtil.android.actionViewIntent(path,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const filteredStudents = studentList.filter(s =>
    (s.fullName || s.name || '').toLowerCase().includes(studentSearch.toLowerCase()) ||
    (s.id || '').toLowerCase().includes(studentSearch.toLowerCase())
  );

  const groupedStudents = CLASS_HIERARCHY.map(cat => ({
    category: cat.category,
    classes: cat.classes.map(cls => ({
      className: cls,
      students: filteredStudents.filter(s => s.class === cls),
    })).filter(c => c.students.length > 0),
  })).filter(cat => cat.classes.length > 0);

  return (
    <View style={styles.root}>

      {/* CREDENTIALS MODAL */}
      <Modal visible={!!credModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{credModal?.fullName || credModal?.name}</Text>
              <TouchableOpacity onPress={() => setCredModal(null)}>
                <XMarkIcon size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>
            {[
              {label: 'Student ID', value: credModal?.id},
              {label: 'Student Pass', value: credModal?.password || 'Not saved', highlight: true},
              {label: 'Class', value: `${credModal?.class} — ${credModal?.section}`},
              {label: 'Roll No', value: credModal?.rollNo || 'N/A'},
              {label: 'Father', value: credModal?.fatherName || 'N/A'},
              {label: 'Parent ID', value: credModal?.parentId || 'N/A'},
              {label: 'Parent Pass', value: credModal?.parentPassword || 'Not saved', highlight: true},
              {label: 'Phone', value: credModal?.parentPhone || 'N/A'},
            ].map((row, i) => (
              <View key={i} style={styles.modalRow}>
                <Text style={styles.modalLabel}>{row.label}</Text>
                <Text style={[styles.modalValue, row.highlight && styles.modalHighlight]}>
                  {row.value}
                </Text>
              </View>
            ))}
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setCredModal(null)}>
              <Text style={styles.modalCloseTxt}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* TEACHER CREDENTIALS MODAL */}
      <Modal visible={!!teacherModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{teacherModal?.name}</Text>
              <TouchableOpacity onPress={() => setTeacherModal(null)}>
                <XMarkIcon size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>
            {[
              {label: 'Teacher ID', value: teacherModal?.id},
              {label: 'Password', value: teacherModal?.password || 'Not saved', highlight: true},
              {label: 'Subject', value: teacherModal?.subject},
              {label: 'Phone', value: teacherModal?.phone || 'N/A'},
              {label: 'Classes', value: teacherModal?.classesAssigned?.join(', ') || 'None'},
            ].map((row, i) => (
              <View key={i} style={styles.modalRow}>
                <Text style={styles.modalLabel}>{row.label}</Text>
                <Text style={[styles.modalValue, (row as any).highlight && styles.modalHighlight]}>
                  {row.value}
                </Text>
              </View>
            ))}
            <TouchableOpacity
              style={[styles.modalCloseBtn, {marginBottom: 8}]}
              onPress={() => {
                setEditClassesModal({...teacherModal});
                setTeacherModal(null);
              }}>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                <PencilSquareIcon size={16} color={theme.colors.gold} />
                <Text style={styles.modalCloseTxt}>Edit Classes</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setTeacherModal(null)}>
              <Text style={styles.modalCloseTxt}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* EDIT CLASSES MODAL */}
      <Modal visible={!!editClassesModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, {maxHeight: '80%'}]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Classes</Text>
              <TouchableOpacity onPress={() => setEditClassesModal(null)}>
                <XMarkIcon size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>{editClassesModal?.name}</Text>

            <ScrollView style={{maxHeight: 350}}>
              {CLASS_HIERARCHY.map((cat, ci) => (
                <View key={ci} style={{marginBottom: 12}}>
                  <Text style={styles.classCatTitle}>{cat.category}</Text>
                  <View style={styles.classChipGrid}>
                    {cat.classes.map((cls, cj) => {
                      const isSelected = (editClassesModal?.classesAssigned || []).includes(cls);
                      return (
                        <TouchableOpacity key={cj}
                          style={[styles.classChip, isSelected && styles.classChipOn]}
                          onPress={() => toggleClassForTeacher(cls)}>
                          <Text style={[styles.classChipTxt, isSelected && styles.classChipTxtOn]}>
                            {cls}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.selectedCount}>
              <Text style={styles.selectedCountTxt}>
                {(editClassesModal?.classesAssigned || []).length} classes selected
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.modalCloseBtn, {backgroundColor: '#16a34a', marginBottom: 8}]}
              onPress={saveTeacherClasses}
              disabled={savingClasses}>
              {savingClasses ? <ActivityIndicator color="#ffffff" /> :
                <Text style={styles.modalCloseTxt}>Save Classes ✅</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setEditClassesModal(null)}>
              <Text style={styles.modalCloseTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* NAVBAR */}
      <View style={styles.navbar}>
        <Text style={styles.brand}>QUANT<Text style={styles.brandAccent}>AIP</Text></Text>
        <TouchableOpacity onPress={() => {auth().signOut(); navigation.navigate('Login');}}>
          <ArrowRightOnRectangleIcon size={22} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>

        {/* DASHBOARD */}
        {tab === 'Dashboard' && (
          <View>
            <View style={styles.welcomeCard}>
              <Text style={styles.welcomeEye}>DASHBOARD</Text>
              <Text style={styles.welcomeTitle}>Good morning, <Text style={styles.welcomeAccent}>Admin</Text></Text>
              <Text style={styles.welcomeSub}>School Code: {SCHOOL_CODE}</Text>
            </View>
            <View style={styles.statsGrid}>
              {STAT_CARDS.map((s, i) => (
                <View key={i} style={styles.statCard}>
                  <s.Icon size={20} color={s.color} />
                  <Text style={[styles.statVal, {color: s.color}]}>{s.val}</Text>
                  <Text style={styles.statLbl}>{s.lbl}</Text>
                </View>
              ))}
            </View>
            <View style={styles.quickGrid}>
              {[
                {label: 'Add Student', icon: UserIcon, tabKey: 'Students'},
                {label: 'Add Teacher', icon: AcademicCapIcon, tabKey: 'Teachers'},
                {label: 'Import Data', icon: ArrowUpTrayIcon, tabKey: 'Import'},
                {label: 'Fee Management', icon: BanknotesIcon, tabKey: 'Fee'},
              ].map((item, i) => (
                <TouchableOpacity key={i} style={styles.quickBtn} onPress={() => setTab(item.tabKey)}>
                  <View style={styles.quickIconBox}>
                    <item.icon size={22} color={theme.colors.gold} />
                  </View>
                  <Text style={styles.quickLbl}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* CLASSES */}
        {tab === 'Classes' && <ClassesScreen />}

        {/* STUDENTS */}
        {tab === 'Students' && (
          <View>
            <View style={styles.subTabRow}>
              {['List', 'Add New'].map(t => (
                <TouchableOpacity key={t}
                  style={[styles.subTab, studentTab === t && styles.subTabOn]}
                  onPress={() => setStudentTab(t)}>
                  <Text style={[styles.subTabTxt, studentTab === t && styles.subTabTxtOn]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {studentTab === 'List' && (
              <View>
                <View style={styles.searchRow}>
                  <MagnifyingGlassIcon size={18} color="#9ca3af" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name or ID..."
                    placeholderTextColor="#b8a88a"
                    value={studentSearch}
                    onChangeText={setStudentSearch}
                  />
                </View>

                {loadingStudents ? (
                  <ActivityIndicator color="#B8960A" size="large" style={{marginTop: 30}} />
                ) : groupedStudents.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <UserGroupIcon size={40} color="#b8a88a" />
                    <Text style={styles.emptyTxt}>No students found</Text>
                  </View>
                ) : (
                  groupedStudents.map((cat, ci) => (
                    <View key={ci} style={styles.categoryBlock}>
                      <TouchableOpacity
                        style={styles.categoryHeader}
                        onPress={() => toggleCategory(cat.category)}>
                        <Text style={styles.categoryTitle}>{cat.category}</Text>
                        <View style={styles.categoryRight}>
                          <Text style={styles.categoryCount}>
                            {cat.classes.reduce((sum, c) => sum + c.students.length, 0)} students
                          </Text>
                          {expandedCategories.includes(cat.category)
                            ? <ChevronDownIcon size={16} color="#B8960A" />
                            : <ChevronRightIcon size={16} color="#B8960A" />}
                        </View>
                      </TouchableOpacity>

                      {expandedCategories.includes(cat.category) && cat.classes.map((cls, cli) => (
                        <View key={cli} style={styles.classBlock}>
                          <Text style={styles.classBlockTitle}>
                            {cls.className} ({cls.students.length})
                          </Text>
                          {cls.students.map((s, si) => (
                            <TouchableOpacity key={si}
                              style={styles.studentCard}
                              onPress={async () => {
                                try {
                                  const parentId = s.parentId || '';
                                  if (!parentId) {
                                    setCredModal({...s, parentPassword: 'Not saved'});
                                    return;
                                  }
                                  const parentDoc = await firestore()
                                    .collection('schools').doc(SCHOOL_CODE)
                                    .collection('parents').doc(parentId)
                                    .get();
                                  const parentPass = parentDoc.data()?.password || 'Not saved';
                                  setCredModal({...s, parentPassword: parentPass});
                                } catch (e) {
                                  setCredModal({...s, parentPassword: 'Not saved'});
                                }
                              }}>
                              <View style={styles.studentCardLeft}>
                                <View style={styles.studentAv}>
                                  <Text style={styles.studentAvTxt}>
                                    {(s.fullName || s.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                                  </Text>
                                </View>
                                <View>
                                  <Text style={styles.studentName}>{s.fullName || s.name}</Text>
                                  <Text style={styles.studentMeta}>Roll {s.rollNo || 'N/A'} · {s.id}</Text>
                                </View>
                              </View>
                              <KeyIcon size={16} color="#B8960A" />
                            </TouchableOpacity>
                          ))}
                        </View>
                      ))}
                    </View>
                  ))
                )}
              </View>
            )}

            {studentTab === 'Add New' && (
              <View>
                <Text style={styles.fieldLabel}>SELECT CLASS *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 12}}>
                  {CLASS_HIERARCHY.flatMap(c => c.classes).map((cls, i) => (
                    <TouchableOpacity key={i}
                      style={[styles.clsChip, selectedClass === cls && styles.clsChipOn]}
                      onPress={() => setSelectedClass(cls)}>
                      <Text style={[styles.clsChipTxt, selectedClass === cls && styles.clsChipTxtOn]}>{cls}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={styles.card}>
                  {[
                    {label: 'FULL NAME *', value: sName, setter: setSName, placeholder: 'e.g. Ayesha Khan'},
                    {label: 'FATHER NAME', value: sFatherName, setter: setSFatherName, placeholder: 'e.g. Mr. Ahmed Khan'},
                    {label: 'SECTION *', value: sSection, setter: setSSection, placeholder: 'e.g. A or Red'},
                    {label: 'ROLL NUMBER', value: sRollNo, setter: setSRollNo, placeholder: 'e.g. 001', keyboard: 'number-pad'},
                    {label: 'DATE OF BIRTH', value: sDob, setter: setSdob, placeholder: 'e.g. 2010-05-15'},
                    {label: 'PARENT PHONE', value: sParentPhone, setter: setSParentPhone, placeholder: 'e.g. 0300-1234567', keyboard: 'phone-pad'},
                  ].map((field, i) => (
                    <View key={i} style={i > 0 ? {marginTop: 12} : {}}>
                      <Text style={styles.fieldLabel}>{field.label}</Text>
                      <TextInput style={styles.input}
                        placeholder={field.placeholder}
                        placeholderTextColor="#b8a88a"
                        value={field.value}
                        onChangeText={field.setter}
                        keyboardType={(field as any).keyboard || 'default'}
                      />
                    </View>
                  ))}
                  {selectedClass ? (
                    <View style={styles.selectedBadge}>
                      <AcademicCapIcon size={14} color="#16a34a" />
                      <Text style={styles.selectedBadgeTxt}>{selectedClass} — Section: {sSection || '?'}</Text>
                    </View>
                  ) : null}
                  <TouchableOpacity
                    style={[styles.addBtn, !selectedClass && styles.addBtnDisabled]}
                    onPress={addStudent} disabled={loading || !selectedClass}>
                    {loading ? <ActivityIndicator color="#ffffff" /> :
                      <View style={styles.btnInner}>
                        <PlusCircleIcon size={18} color="#ffffff" />
                        <Text style={styles.addBtnTxt}>Add Student & Generate ID</Text>
                      </View>}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* TEACHERS */}
        {tab === 'Teachers' && (
          <View>
            <View style={styles.subTabRow}>
              {['List', 'Add New'].map(t => (
                <TouchableOpacity key={t}
                  style={[styles.subTab, teacherTab === t && styles.subTabOn]}
                  onPress={() => setTeacherTab(t)}>
                  <Text style={[styles.subTabTxt, teacherTab === t && styles.subTabTxtOn]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {teacherTab === 'List' && (
              <View>
                {loadingTeachers ? (
                  <ActivityIndicator color="#B8960A" size="large" style={{marginTop: 30}} />
                ) : teacherList.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <AcademicCapIcon size={40} color="#b8a88a" />
                    <Text style={styles.emptyTxt}>No teachers added yet</Text>
                  </View>
                ) : (
                  teacherList.map((t, i) => (
                    <TouchableOpacity key={i} style={styles.studentCard}
                      onPress={() => setTeacherModal(t)}>
                      <View style={styles.studentCardLeft}>
                        <View style={styles.studentAv}>
                          <Text style={styles.studentAvTxt}>
                            {(t.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                          </Text>
                        </View>
                        <View>
                          <Text style={styles.studentName}>{t.name}</Text>
                          <Text style={styles.studentMeta}>{t.subject} · {t.id}</Text>
                          {t.classesAssigned?.length > 0 && (
                            <Text style={styles.studentMeta}>
                              {t.classesAssigned.length} class{t.classesAssigned.length > 1 ? 'es' : ''} assigned
                            </Text>
                          )}
                        </View>
                      </View>
                      <View style={styles.teacherActions}>
                        <TouchableOpacity
                          style={styles.editClassesBtn}
                          onPress={() => setEditClassesModal({...t})}>
                          <PencilSquareIcon size={16} color="#B8960A" />
                        </TouchableOpacity>
                        <KeyIcon size={16} color="#B8960A" />
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            {teacherTab === 'Add New' && (
              <View>
                <View style={styles.card}>
                  {[
                    {label: 'FULL NAME *', value: tName, setter: setTName, placeholder: 'e.g. Mr. Qaiser'},
                    {label: 'SUBJECT *', value: tSubject, setter: setTSubject, placeholder: 'e.g. Mathematics'},
                    {label: 'PHONE', value: tPhone, setter: setTPhone, placeholder: 'e.g. 0300-1234567', keyboard: 'phone-pad'},
                  ].map((field, i) => (
                    <View key={i} style={i > 0 ? {marginTop: 12} : {}}>
                      <Text style={styles.fieldLabel}>{field.label}</Text>
                      <TextInput style={styles.input}
                        placeholder={field.placeholder}
                        placeholderTextColor="#b8a88a"
                        value={field.value}
                        onChangeText={field.setter}
                        keyboardType={(field as any).keyboard || 'default'}
                      />
                    </View>
                  ))}
                  <View style={{marginTop: 12}}>
                    <Text style={styles.fieldLabel}>CLASSES ASSIGNED (optional)</Text>
                    <TextInput style={styles.input}
                      placeholder="e.g. Grade 9, Grade 10"
                      placeholderTextColor="#b8a88a"
                      value={tClasses}
                      onChangeText={setTClasses}
                    />
                    <Text style={styles.inputHint}>You can also assign classes later from teacher list</Text>
                  </View>
                  <TouchableOpacity style={styles.addBtn}
                    onPress={addTeacher} disabled={loading}>
                    {loading ? <ActivityIndicator color="#ffffff" /> :
                      <View style={styles.btnInner}>
                        <PlusCircleIcon size={18} color="#ffffff" />
                        <Text style={styles.addBtnTxt}>Add Teacher & Generate ID</Text>
                      </View>}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
        {/* RESULTS */}
{tab === 'Results' && (
  <View>
    <Text style={styles.sectionTitle}>Generate Result</Text>

    {/* Test Type */}
    <Text style={styles.fieldLabel}>TEST TYPE</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 12}}>
      {[
        {key: 'weekly', label: 'Weekly'},
        {key: 'monthly', label: 'Monthly'},
        {key: 'midterm', label: 'Mid Term'},
        {key: 'sendup', label: 'Send Up'},
        {key: 'final', label: 'Final'},
      ].map((t, i) => (
        <TouchableOpacity key={i}
          style={[styles.clsChip, resultTestType === t.key && styles.clsChipOn]}
          onPress={() => setResultTestType(t.key)}>
          <Text style={[styles.clsChipTxt, resultTestType === t.key && styles.clsChipTxtOn]}>
            {t.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>

    {/* Class */}
    <Text style={styles.fieldLabel}>CLASS</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 16}}>
      {CLASS_HIERARCHY.flatMap(c => c.classes).map((cls, i) => (
        <TouchableOpacity key={i}
          style={[styles.clsChip, resultClass === cls && styles.clsChipOn]}
          onPress={() => setResultClass(cls)}>
          <Text style={[styles.clsChipTxt, resultClass === cls && styles.clsChipTxtOn]}>{cls}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>

    <TouchableOpacity
      style={[styles.addBtn, (!resultTestType || !resultClass) && styles.addBtnDisabled]}
      disabled={!resultTestType || !resultClass || generatingResult}
      onPress={generateResult}>
      {generatingResult ? <ActivityIndicator color="#ffffff" /> :
        <View style={styles.btnInner}>
          <TrophyIcon size={18} color="#ffffff" />
          <Text style={styles.addBtnTxt}>Generate Result</Text>
        </View>}
    </TouchableOpacity>

    {/* Result Preview */}
    {resultPreview.length > 0 && (
      <View style={{marginTop: 16}}>
        <Text style={styles.sectionTitle}>
          Result — {resultClass}
        </Text>
        {resultPreview.map((s, i) => (
          <View key={i} style={[styles.card, {marginBottom: 8}]}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
                <View style={[styles.studentAv, {
                  backgroundColor: s.position <= 3 ? '#fffbeb' : '#fdf8ee',
                  borderColor: s.position <= 3 ? '#f59e0b' : '#B8960A',
                }]}>
                  <Text style={[styles.studentAvTxt, {
                    color: s.position <= 3 ? '#f59e0b' : '#B8960A',
                  }]}>
                    #{s.position}
                  </Text>
                </View>
                <View>
                  <Text style={styles.studentName}>{s.name}</Text>
                  <Text style={styles.studentMeta}>Roll {s.rollNo} · {s.percentage}%</Text>
                </View>
              </View>
              <View style={{
                backgroundColor: s.grade === 'A+' ? '#f0fdf4' : s.grade === 'F' ? '#fef2f2' : '#fdf8ee',
                borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
                borderWidth: 1,
                borderColor: s.grade === 'A+' ? '#86efac' : s.grade === 'F' ? '#fca5a5' : '#e8d5a3',
              }}>
                <Text style={{
                  fontSize: 14, fontWeight: '700',
                  color: s.grade === 'A+' ? '#16a34a' : s.grade === 'F' ? '#ef4444' : '#B8960A',
                }}>{s.grade}</Text>
              </View>
            </View>

            {/* Subject breakdown */}
            {Object.keys(s.subjects).map((subj, si) => (
              <View key={si} style={{
                flexDirection: 'row', justifyContent: 'space-between',
                paddingVertical: 4, borderTopWidth: 1, borderTopColor: '#f3f4f6',
              }}>
                <Text style={{fontSize: 12, color: '#6b7280'}}>{subj}</Text>
                <Text style={{fontSize: 12, fontWeight: '600', color: '#1e1b4b'}}>
                  {s.subjects[subj].obtained}/{s.subjects[subj].total} · {s.subjects[subj].grade}
                </Text>
              </View>
            ))}

            <View style={{
              flexDirection: 'row', justifyContent: 'space-between',
              marginTop: 8, paddingTop: 8, borderTopWidth: 1.5, borderTopColor: '#ece5d3',
            }}>
              <Text style={{fontSize: 13, fontWeight: '700', color: '#0d1f3c'}}>Total</Text>
              <Text style={{fontSize: 13, fontWeight: '700', color: '#B8960A'}}>
                {s.totalObtained}/{s.totalMarks} ({s.percentage}%)
              </Text>
            </View>
          </View>
        ))}
      </View>
    )}
  </View>
)}

        {/* TIMETABLE */}
        {tab === 'Timetable' && (
          <View>
            <Text style={styles.sectionTitle}>Class Timetable</Text>

            {/* Class selector */}
            <Text style={styles.fieldLabel}>SELECT CLASS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 12}}>
              {ALL_CLASSES.map((cls, i) => (
                <TouchableOpacity key={i}
                  style={[styles.clsChip, ttClass === cls && styles.clsChipOn]}
                  onPress={() => loadTimetable(cls)}>
                  <Text style={[styles.clsChipTxt, ttClass === cls && styles.clsChipTxtOn]}>{cls}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {loadingTT && <ActivityIndicator color="#B8960A" style={{marginVertical: 20}} />}

            {ttClass && ttData && !loadingTT && (
              <View>
                {/* Day selector */}
                <Text style={styles.fieldLabel}>DAY</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 12}}>
                  {DAYS.map((d, i) => (
                    <TouchableOpacity key={i}
                      style={[styles.clsChip, ttDay === d && styles.clsChipOn]}
                      onPress={() => setTtDay(d)}>
                      <Text style={[styles.clsChipTxt, ttDay === d && styles.clsChipTxtOn]}>
                        {d}{d === 'Friday' ? ' 🕌' : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Slot editor */}
                {ttData[ttDay]?.map((slot: any, i: number) => (
                  <View key={i} style={[
                    styles.card,
                    {marginBottom: 8},
                    slot.period === 0 && {backgroundColor: '#f0fdf4', borderColor: '#bbf7d0'},
                  ]}>
                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                      <View style={{
                        width: 30, height: 30, borderRadius: 15,
                        backgroundColor: slot.period === 0 ? '#dcfce7' : '#fdf8ee',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Text style={{fontSize: 12, fontWeight: '700', color: slot.period === 0 ? '#16a34a' : '#B8960A'}}>
                          {slot.period === 0 ? '🍎' : slot.period}
                        </Text>
                      </View>
                      <TextInput
                        style={{
                          flex: 1, borderWidth: 1, borderColor: '#ece5d3', borderRadius: 8,
                          paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, color: '#0d1f3c',
                        }}
                        placeholder="Time (e.g. 8:00 - 8:40)"
                        placeholderTextColor="#b8a88a"
                        value={slot.time}
                        onChangeText={t => updateTTSlot(i, 'time', t)}
                      />
                    </View>
                    {slot.period !== 0 && (
                      <View style={{flexDirection: 'row', gap: 8, marginTop: 8}}>
                        <TextInput
                          style={{
                            flex: 1, borderWidth: 1, borderColor: '#ece5d3', borderRadius: 8,
                            paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, color: '#0d1f3c',
                          }}
                          placeholder="Subject"
                          placeholderTextColor="#b8a88a"
                          value={slot.subject}
                          onChangeText={t => updateTTSlot(i, 'subject', t)}
                        />
                        <TextInput
                          style={{
                            flex: 1, borderWidth: 1, borderColor: '#ece5d3', borderRadius: 8,
                            paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, color: '#0d1f3c',
                          }}
                          placeholder="Teacher"
                          placeholderTextColor="#b8a88a"
                          value={slot.teacher}
                          onChangeText={t => updateTTSlot(i, 'teacher', t)}
                        />
                      </View>
                    )}
                  </View>
                ))}

                {/* Copy day button */}
                <TouchableOpacity
                  style={[styles.addBtn, {marginBottom: 10}]}
                  onPress={copyTTDayToOthers}>
                  <View style={styles.btnInner}>
                    <DocumentDuplicateIcon size={18} color="#ffffff" />
                    <Text style={styles.addBtnTxt}>Copy {ttDay} to All Days</Text>
                  </View>
                </TouchableOpacity>

                {/* Save button */}
                <TouchableOpacity
                  style={styles.addBtn}
                  disabled={savingTT}
                  onPress={saveTimetable}>
                  {savingTT ? <ActivityIndicator color="#ffffff" /> :
                    <View style={styles.btnInner}>
                      <CalendarDaysIcon size={18} color="#ffffff" />
                      <Text style={styles.addBtnTxt}>Save Timetable — {ttClass}</Text>
                    </View>}
                </TouchableOpacity>
              </View>
            )}

            {!ttClass && !loadingTT && (
              <Text style={{fontSize: 13, color: '#9ca3af', textAlign: 'center', marginTop: 20}}>
                Select a class above
              </Text>
            )}
          </View>
        )}

        {/* FEE */}
        {tab === 'Fee' && <FeeScreen />}

        {/* REPORTS */}
        {tab === 'Reports' && (() => {
          // Client-side compute karo selected month ke liye
          const studentsWithData = reportStudents.filter(s => {
            const {total} = calcMonthStats(s.attendanceMap, reportMonth);
            return total > 0;
          });

          // Overall summary
          let totalPresent = 0, totalAbsent = 0, totalLate = 0;
          studentsWithData.forEach(s => {
            const {present, absent, late} = calcMonthStats(s.attendanceMap, reportMonth);
            totalPresent += present; totalAbsent += absent; totalLate += late;
          });
          const grandTotal = totalPresent + totalAbsent + totalLate;
          const overallPct = grandTotal > 0
            ? Math.round(((totalPresent + totalLate) / grandTotal) * 100) : 0;

          // Class-wise breakdown
          const classStats = ALL_CLASSES.map(cls => {
            const clsStudents = studentsWithData.filter(s => s.class === cls);
            if (clsStudents.length === 0) return null;
            let p = 0, a = 0, l = 0;
            clsStudents.forEach(s => {
              const st = calcMonthStats(s.attendanceMap, reportMonth);
              p += st.present; a += st.absent; l += st.late;
            });
            const tot = p + a + l;
            const pct = tot > 0 ? Math.round(((p + l) / tot) * 100) : 0;
            return {cls, pct, students: clsStudents.length};
          }).filter(Boolean) as {cls: string; pct: number; students: number}[];

          // At-risk: sirf students jinki pct < 75, data wale
          const atRisk = studentsWithData
            .map(s => ({...s, _pct: calcMonthStats(s.attendanceMap, reportMonth).pct}))
            .filter(s => s._pct >= 0 && s._pct < 75)
            .sort((a, b) => a._pct - b._pct);

          // Teacher monthly stats
          const todayKey = new Date().toISOString().split('T')[0];
          const selectedMonthLabel = MONTH_LIST.find(m => m.prefix === reportMonth)?.label || '';

          return (
            <View>
              <Text style={styles.sectionTitle}>Attendance Reports</Text>

              {/* Month selector */}
              <Text style={styles.fieldLabel}>SELECT MONTH</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 16}}>
                {MONTH_LIST.map((m, i) => (
                  <TouchableOpacity key={i}
                    style={[styles.clsChip, reportMonth === m.prefix && styles.clsChipOn]}
                    onPress={() => setReportMonth(m.prefix)}>
                    <Text style={[styles.clsChipTxt, reportMonth === m.prefix && styles.clsChipTxtOn]}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {loadingReport ? (
                <ActivityIndicator color="#B8960A" size="large" style={{marginVertical: 30}} />
              ) : (
                <View>
                  {/* ── SUMMARY CARDS ── */}
                  <View style={styles.rptSummaryRow}>
                    <View style={[styles.rptSummaryCard, {backgroundColor: '#fdf8ee', borderColor: '#e8d5a3'}]}>
                      <Text style={[styles.rptSummaryVal, {color: '#B8960A'}]}>{overallPct}%</Text>
                      <Text style={styles.rptSummaryLbl}>Overall</Text>
                    </View>
                    <View style={[styles.rptSummaryCard, {backgroundColor: '#f0fdf4', borderColor: '#86efac'}]}>
                      <Text style={[styles.rptSummaryVal, {color: '#16a34a'}]}>{totalPresent + totalLate}</Text>
                      <Text style={styles.rptSummaryLbl}>Present</Text>
                    </View>
                    <View style={[styles.rptSummaryCard, {backgroundColor: '#fef2f2', borderColor: '#fca5a5'}]}>
                      <Text style={[styles.rptSummaryVal, {color: '#ef4444'}]}>{totalAbsent}</Text>
                      <Text style={styles.rptSummaryLbl}>Absent</Text>
                    </View>
                  </View>
                  <Text style={styles.rptNote}>* Late counts as Present in all percentage calculations.</Text>

                  {/* ── CLASS-WISE BREAKDOWN ── */}
                  <Text style={[styles.sectionTitle, {marginTop: 18}]}>Class-wise Breakdown</Text>
                  {classStats.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <Text style={styles.emptyTxt}>No data for {selectedMonthLabel}</Text>
                    </View>
                  ) : (
                    classStats.map((row, i) => {
                      const low = row.pct < 75;
                      const barColor = row.pct >= 75 ? '#B8960A' : row.pct >= 60 ? '#f59e0b' : '#ef4444';
                      return (
                        <View key={i} style={[styles.rptClassRow, low && {borderColor: '#fde68a', backgroundColor: '#fffbeb'}]}>
                          <View style={styles.rptClassTop}>
                            <Text style={styles.rptClassName}>{row.cls}</Text>
                            <Text style={[styles.rptClassPct, {color: barColor}]}>{row.pct}%</Text>
                          </View>
                          <View style={styles.rptBarBg}>
                            <View style={[styles.rptBarFill, {width: `${row.pct}%`, backgroundColor: barColor}]} />
                          </View>
                          <Text style={styles.rptClassMeta}>{row.students} student{row.students !== 1 ? 's' : ''} with data</Text>
                        </View>
                      );
                    })
                  )}

                  {/* ── AT-RISK STUDENTS ── */}
                  <Text style={[styles.sectionTitle, {marginTop: 18}]}>At-Risk Students</Text>
                  <Text style={styles.rptNote}>Students below 75% attendance for {selectedMonthLabel}</Text>
                  {atRisk.length === 0 ? (
                    <View style={[styles.rptEmptyGreen]}>
                      <Text style={styles.rptEmptyGreenTxt}>✅ All students are above 75% this month.</Text>
                    </View>
                  ) : (
                    atRisk.map((s, i) => (
                      <View key={i} style={styles.rptAtRiskCard}>
                        <View style={styles.studentAv}>
                          <Text style={[styles.studentAvTxt, {color: '#ef4444'}]}>
                            {(s.fullName || s.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                          </Text>
                        </View>
                        <View style={{flex: 1}}>
                          <Text style={styles.studentName}>{s.fullName || s.name}</Text>
                          <Text style={styles.studentMeta}>{s.class}{s.section ? ` — ${s.section}` : ''}</Text>
                        </View>
                        <View style={styles.rptAtRiskBadge}>
                          <Text style={styles.rptAtRiskPct}>{s._pct}%</Text>
                        </View>
                      </View>
                    ))
                  )}

                  {/* ── TEACHER ATTENDANCE — TODAY ── */}
                  <Text style={[styles.sectionTitle, {marginTop: 24}]}>Teacher Attendance — Today</Text>
                  <Text style={styles.rptNote}>{todayKey}</Text>
                  {reportTeachers.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <Text style={styles.emptyTxt}>No teachers found</Text>
                    </View>
                  ) : (
                    <View>
                      {reportTeachers.map((t, i) => {
                        const status = teacherAtt[t.id];
                        return (
                          <View key={i} style={styles.rptTeacherRow}>
                            <View style={styles.studentAv}>
                              <Text style={styles.studentAvTxt}>
                                {(t.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                              </Text>
                            </View>
                            <View style={{flex: 1}}>
                              <Text style={styles.studentName}>{t.name}</Text>
                              <Text style={styles.studentMeta}>{t.subject}</Text>
                            </View>
                            <View style={styles.rptAttBtnGroup}>
                              {(['P', 'A'] as const).map(btn => (
                                <TouchableOpacity key={btn}
                                  style={[styles.rptAttBtn,
                                    status === btn && (btn === 'P' ? styles.rptAttBtnPOn : styles.rptAttBtnAOn),
                                  ]}
                                  onPress={() => setTeacherAtt(prev => ({...prev, [t.id]: btn}))}>
                                  <Text style={[styles.rptAttBtnTxt,
                                    status === btn && {color: btn === 'P' ? '#16a34a' : '#ef4444', fontWeight: '700'},
                                  ]}>{btn}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        );
                      })}
                      <TouchableOpacity
                        style={[styles.addBtn, {marginBottom: 8}]}
                        onPress={saveTeacherAttendance}
                        disabled={savingTeacherAtt}>
                        {savingTeacherAtt
                          ? <ActivityIndicator color="#ffffff" />
                          : <Text style={styles.addBtnTxt}>Save Teacher Attendance</Text>}
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* ── TEACHER MONTHLY ATTENDANCE ── */}
                  <Text style={[styles.sectionTitle, {marginTop: 18}]}>Teacher Monthly Attendance</Text>
                  <Text style={styles.rptNote}>{selectedMonthLabel} · P/A only (Late rule does not apply)</Text>
                  {reportTeachers.map((t, i) => {
                    const map = t.attendanceMap || {};
                    let tp = 0, ta = 0;
                    Object.keys(map).forEach(d => {
                      if (!d.startsWith(reportMonth)) return;
                      if (map[d] === 'P') tp++;
                      else if (map[d] === 'A') ta++;
                    });
                    const tot = tp + ta;
                    if (tot === 0) return null;
                    const pct = Math.round((tp / tot) * 100);
                    const barColor = pct >= 75 ? '#0284c7' : pct >= 60 ? '#f59e0b' : '#ef4444';
                    return (
                      <View key={i} style={styles.rptClassRow}>
                        <View style={styles.rptClassTop}>
                          <Text style={styles.rptClassName}>{t.name}</Text>
                          <Text style={[styles.rptClassPct, {color: barColor}]}>{pct}%</Text>
                        </View>
                        <View style={styles.rptBarBg}>
                          <View style={[styles.rptBarFill, {width: `${pct}%`, backgroundColor: barColor}]} />
                        </View>
                        <Text style={styles.rptClassMeta}>{tp}P / {ta}A this month</Text>
                      </View>
                    );
                  })}
                </View>
              )}
              <View style={{height: 30}} />
            </View>
          );
        })()}

        {/* IMPORT */}
        {tab === 'Import' && (
          <View>
            <Text style={styles.sectionTitle}>Import from Excel</Text>
            <View style={styles.card}>
              <Text style={styles.importTitle}>Bulk Import</Text>
              <Text style={styles.importDesc}>
                Upload Excel file. Each sheet = one class. "Teachers" sheet = teachers.
              </Text>
              <View style={styles.excelFormat}>
                <Text style={styles.excelFormatTitle}>Excel Sheet Structure:</Text>
                <Text style={styles.excelCol}>• Sheet "Teachers": Name, Subject, Phone, Classes Assigned</Text>
                <Text style={styles.excelCol}>• Sheet "Grade 9": Name, Father Name, Section, Roll No, Parent Phone</Text>
              </View>
              {importProgress ? (
                <View style={styles.progressBox}>
                  <ActivityIndicator size="small" color="#16a34a" style={{marginRight: 8}} />
                  <Text style={styles.progressTxt}>{importProgress}</Text>
                </View>
              ) : null}
              <TouchableOpacity style={[styles.addBtn, {backgroundColor: '#16a34a'}]} onPress={importFromExcel}>
                <View style={styles.btnInner}>
                  <ArrowUpTrayIcon size={18} color="#ffffff" />
                  <Text style={styles.addBtnTxt}>Select Excel File & Import</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.addBtn, {backgroundColor: '#0891b2', marginTop: 10}]} onPress={downloadTemplate}>
                <View style={styles.btnInner}>
                  <ArrowUpTrayIcon size={18} color="#ffffff" />
                  <Text style={styles.addBtnTxt}>Download Excel Template</Text>
                </View>
              </TouchableOpacity>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoTxt}>Download template → fill data → import.</Text>
            </View>
          </View>
        )}

        <View style={{height: 80}} />
      </ScrollView>

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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#faf8f2'},
  navbar: {
    backgroundColor: '#0d1f3c', paddingTop: 50, paddingBottom: 16,
    paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {fontSize: 20, fontWeight: '700', color: '#ffffff', letterSpacing: 2},
  brandAccent: {color: '#C9A84C'},

  // ── BOTTOM TAB BAR ──
  bottomBar: {backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#ece5d3'},
  bottomBarContent: {paddingHorizontal: 4, paddingVertical: 6},
  bottomTab: {alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 4, gap: 2, minWidth: 70},
  bottomTabTxt: {fontSize: 10, fontWeight: '500', color: '#94a3b8'},
  bottomTabTxtOn: {color: '#B8960A', fontWeight: '700'},

  content: {flex: 1, paddingHorizontal: 14, paddingTop: 14},
  welcomeCard: {backgroundColor: '#0d1f3c', borderRadius: 16, padding: 20, marginBottom: 16},
  welcomeEye: {fontSize: 10, letterSpacing: 4, color: '#C9A84C', fontWeight: '600', marginBottom: 6},
  welcomeTitle: {fontSize: 22, fontWeight: '700', color: '#ffffff', marginBottom: 4},
  welcomeAccent: {color: '#C9A84C'},
  welcomeSub: {fontSize: 13, color: 'rgba(255,255,255,0.6)'},
  statsGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16},
  statCard: {
    width: '47%', borderRadius: 12, padding: 14, gap: 6,
    backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#ece5d3',
    borderLeftWidth: 4, borderLeftColor: '#B8960A',
  },
  statVal: {fontSize: 26, fontWeight: '700'},
  statLbl: {fontSize: 12, color: '#6b7280', fontWeight: '500'},
  quickGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16},
  quickBtn: {width: '47%', backgroundColor: '#ffffff', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#ece5d3', gap: 10},
  quickIconBox: {width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fdf8ee'},
  quickLbl: {fontSize: 13, fontWeight: '600', color: '#0d1f3c', textAlign: 'center'},
  subTabRow: {flexDirection: 'row', backgroundColor: '#ffffff', borderRadius: 12, padding: 4, marginBottom: 14, borderWidth: 1, borderColor: '#ece5d3'},
  subTab: {flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10},
  subTabOn: {backgroundColor: '#0d1f3c'},
  subTabTxt: {fontSize: 13, fontWeight: '500', color: '#9ca3af'},
  subTabTxtOn: {color: '#C9A84C', fontWeight: '700'},
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#ffffff', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#ece5d3', marginBottom: 12,
  },
  searchInput: {flex: 1, fontSize: 14, color: '#0d1f3c'},
  emptyBox: {alignItems: 'center', paddingVertical: 40, gap: 10},
  emptyTxt: {fontSize: 14, color: '#9ca3af', fontWeight: '500'},
  categoryBlock: {marginBottom: 8},
  categoryHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#ffffff', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#ece5d3', marginBottom: 4,
  },
  categoryTitle: {fontSize: 15, fontWeight: '700', color: '#0d1f3c'},
  categoryRight: {flexDirection: 'row', alignItems: 'center', gap: 8},
  categoryCount: {fontSize: 12, color: '#B8960A', fontWeight: '600'},
  classBlock: {marginLeft: 12, marginBottom: 6},
  classBlockTitle: {
    fontSize: 12, fontWeight: '700', color: '#6b7280',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, marginTop: 4,
  },
  studentCard: {
    backgroundColor: '#ffffff', borderRadius: 10, padding: 12,
    marginBottom: 6, borderWidth: 1, borderColor: '#ece5d3',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  studentCardLeft: {flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1},
  studentAv: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#fdf8ee', borderWidth: 1.5, borderColor: '#B8960A',
    alignItems: 'center', justifyContent: 'center',
  },
  studentAvTxt: {fontSize: 11, fontWeight: '700', color: '#B8960A'},
  studentName: {fontSize: 13, fontWeight: '600', color: '#0d1f3c'},
  studentMeta: {fontSize: 11, color: '#9ca3af', marginTop: 1},
  teacherActions: {flexDirection: 'row', alignItems: 'center', gap: 10},
  editClassesBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#fdf8ee', borderWidth: 1, borderColor: '#ece5d3',
    alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: {fontSize: 17, fontWeight: '700', color: '#0d1f3c', marginBottom: 10},
  fieldLabel: {fontSize: 11, fontWeight: '600', color: '#B8960A', letterSpacing: 2, marginBottom: 8},
  clsChip: {borderWidth: 1, borderColor: '#ece5d3', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#ffffff', marginRight: 6},
  clsChipOn: {borderColor: '#B8960A', backgroundColor: '#fdf8ee'},
  clsChipTxt: {fontSize: 12, fontWeight: '500', color: '#6b7280'},
  clsChipTxtOn: {color: '#B8960A', fontWeight: '700'},
  card: {backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#ece5d3'},
  input: {backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#ece5d3', borderRadius: 10, padding: 13, fontSize: 14, color: '#0d1f3c', fontWeight: '500'},
  inputHint: {fontSize: 11, color: '#9ca3af', marginTop: 4},
  selectedBadge: {flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f0fdf4', borderRadius: 8, padding: 10, marginTop: 12, borderWidth: 1, borderColor: '#bbf7d0'},
  selectedBadgeTxt: {fontSize: 13, color: '#16a34a', fontWeight: '600'},
  addBtn: {backgroundColor: '#0d1f3c', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 16},
  addBtnDisabled: {backgroundColor: '#9ca3af'},
  btnInner: {flexDirection: 'row', alignItems: 'center', gap: 8},
  addBtnTxt: {color: '#C9A84C', fontSize: 14, fontWeight: '700'},
  infoCard: {backgroundColor: '#fffbeb', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#fde68a', marginBottom: 16},
  infoTxt: {fontSize: 13, color: '#92400e', lineHeight: 20},
  importTitle: {fontSize: 16, fontWeight: '700', color: '#0d1f3c', marginBottom: 8},
  importDesc: {fontSize: 13, color: '#6b7280', lineHeight: 20, marginBottom: 14},
  excelFormat: {backgroundColor: '#fdf8ee', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#ece5d3'},
  excelFormatTitle: {fontSize: 12, fontWeight: '700', color: '#B8960A', marginBottom: 6},
  excelCol: {fontSize: 12, color: '#6b7280', marginBottom: 4, lineHeight: 18},
  progressBox: {flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf4', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#bbf7d0'},
  progressTxt: {fontSize: 13, color: '#16a34a', fontWeight: '600', flex: 1},
  modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20},
  modalBox: {backgroundColor: '#ffffff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 360},
  modalHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16},
  modalTitle: {fontSize: 16, fontWeight: '700', color: '#0d1f3c'},
  modalSub: {fontSize: 12, color: '#9ca3af', marginBottom: 14},
  modalRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6'},
  modalLabel: {fontSize: 12, color: '#6b7280', fontWeight: '500'},
  modalValue: {fontSize: 12, color: '#0d1f3c', fontWeight: '600', flex: 1, textAlign: 'right'},
  modalHighlight: {color: '#B8960A', fontSize: 14},
  modalCloseBtn: {backgroundColor: '#0d1f3c', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 8},
  modalCloseTxt: {color: '#C9A84C', fontSize: 14, fontWeight: '700'},
  classCatTitle: {fontSize: 12, fontWeight: '700', color: '#6b7280', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8},
  classChipGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  classChip: {borderWidth: 1, borderColor: '#ece5d3', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#ffffff'},
  classChipOn: {borderColor: '#B8960A', backgroundColor: '#fdf8ee'},
  classChipTxt: {fontSize: 12, fontWeight: '500', color: '#6b7280'},
  classChipTxtOn: {color: '#B8960A', fontWeight: '700'},
  selectedCount: {backgroundColor: '#fdf8ee', borderRadius: 8, padding: 10, marginTop: 8, marginBottom: 8, alignItems: 'center'},
  selectedCountTxt: {fontSize: 13, color: '#B8960A', fontWeight: '600'},

  // ── REPORTS STYLES ──
  rptSummaryRow: {flexDirection: 'row', gap: 10, marginBottom: 6},
  rptSummaryCard: {flex: 1, borderRadius: 12, padding: 14, borderWidth: 1, alignItems: 'center', gap: 4},
  rptSummaryVal: {fontSize: 24, fontWeight: '700'},
  rptSummaryLbl: {fontSize: 11, color: '#6b7280', fontWeight: '500'},
  rptNote: {fontSize: 11, color: '#9ca3af', marginBottom: 10, lineHeight: 16},
  rptClassRow: {
    backgroundColor: '#ffffff', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#ece5d3',
  },
  rptClassTop: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8},
  rptClassName: {fontSize: 13, fontWeight: '600', color: '#0d1f3c'},
  rptClassPct: {fontSize: 14, fontWeight: '700'},
  rptBarBg: {height: 6, backgroundColor: '#f3f4f6', borderRadius: 3, overflow: 'hidden', marginBottom: 6},
  rptBarFill: {height: 6, borderRadius: 3},
  rptClassMeta: {fontSize: 11, color: '#9ca3af'},
  rptAtRiskCard: {
    backgroundColor: '#fff5f5', borderRadius: 10, padding: 12,
    marginBottom: 6, borderWidth: 1, borderColor: '#fca5a5',
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  rptAtRiskBadge: {
    backgroundColor: '#fef2f2', borderRadius: 8, paddingHorizontal: 10,
    paddingVertical: 6, borderWidth: 1, borderColor: '#fca5a5',
  },
  rptAtRiskPct: {fontSize: 14, fontWeight: '700', color: '#ef4444'},
  rptEmptyGreen: {
    backgroundColor: '#f0fdf4', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#86efac', alignItems: 'center', marginBottom: 12,
  },
  rptEmptyGreenTxt: {fontSize: 13, color: '#16a34a', fontWeight: '600'},
  rptTeacherRow: {
    backgroundColor: '#ffffff', borderRadius: 10, padding: 12,
    marginBottom: 6, borderWidth: 1, borderColor: '#ece5d3',
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  rptAttBtnGroup: {flexDirection: 'row', gap: 6},
  rptAttBtn: {
    width: 36, height: 36, borderRadius: 8, borderWidth: 1.5,
    borderColor: '#e5e7eb', backgroundColor: '#f9fafb',
    alignItems: 'center', justifyContent: 'center',
  },
  rptAttBtnPOn: {backgroundColor: '#f0fdf4', borderColor: '#86efac'},
  rptAttBtnAOn: {backgroundColor: '#fef2f2', borderColor: '#fca5a5'},
  rptAttBtnTxt: {fontSize: 12, fontWeight: '500', color: '#9ca3af'},
});
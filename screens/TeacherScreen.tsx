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
} from 'react-native-heroicons/outline';

import {SCHOOL_CODE} from '../config';

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
        .collection('schools').doc(SCHOOL_CODE)
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

  // Attendance states
  const [selectedAttClass, setSelectedAttClass] = useState('');
  const [attStudents, setAttStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<{[key: string]: string}>({});
  const [loadingAtt, setLoadingAtt] = useState(false);
  const [submittingAtt, setSubmittingAtt] = useState(false);
  const [attSubmitted, setAttSubmitted] = useState(false);

  // Marks states
  const [marksStep, setMarksStep] = useState(1);
  const [testType, setTestType] = useState('');
  const [totalMarks, setTotalMarks] = useState('');
  const [selectedMarksClass, setSelectedMarksClass] = useState('');
  const [marksStudents, setMarksStudents] = useState<any[]>([]);
  const [marks, setMarks] = useState<{[key: string]: string}>({});
  const [loadingMarks, setLoadingMarks] = useState(false);
  const [submittingMarks, setSubmittingMarks] = useState(false);

  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  useEffect(() => {
    loadTeacher();
  }, []);

  const loadTeacher = async () => {
    try {
      const user = auth().currentUser;
      if (!user) return;
      const id = user.email?.split('@')[0].toUpperCase();

      const doc = await firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('teachers').doc(id)
        .get();

      if (doc.exists) {
        const teacherData = doc.data();
        setTeacher(teacherData);
        setClasses(teacherData?.classesAssigned || []);

        // Check incharge classes
        const classesSnap = await firestore()
          .collection('schools').doc(SCHOOL_CODE)
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
        .collection('schools').doc(SCHOOL_CODE)
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
          .collection('schools').doc(SCHOOL_CODE)
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
          .collection('schools').doc(SCHOOL_CODE)
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
  // ── MARKS ──
  const loadMarksStudents = async (cls: string) => {
    setSelectedMarksClass(cls);
    setMarks({});
    setLoadingMarks(true);
    try {
      const snapshot = await firestore()
        .collection('schools').doc(SCHOOL_CODE)
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
    const unmarked = marksStudents.filter(s => marks[s.id] === undefined || marks[s.id] === '');
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
        .collection('schools').doc(SCHOOL_CODE)
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
        const obtainedRaw = marks[s.id] || '0';
        const obtained = isNaN(parseInt(obtainedRaw)) ? 0 : parseInt(obtainedRaw);
        const percentage = Math.round((obtained / total) * 100);
        const grade = percentage >= 90 ? 'A+' : percentage >= 80 ? 'A' :
          percentage >= 70 ? 'B+' : percentage >= 60 ? 'B' :
          percentage >= 50 ? 'C' : 'F';

        const ref = firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('marks').doc(testId)
        .collection('students').doc(s.id);
        batch.set(ref, {
          studentId: s.id,
          name: s.fullName || s.name,
          obtained,
          total,
          percentage,
          grade,
          class: selectedMarksClass,
          subject: teacher?.subject,
          testType,
          date: dateKey,
        });
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

    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmittingMarks(false);
    }
  };

  const present = Object.values(attendance).filter(v => v === 'P').length;
  const absent = Object.values(attendance).filter(v => v === 'A').length;
  const late = Object.values(attendance).filter(v => v === 'L').length;
  const allMarked = attStudents.length > 0 && Object.keys(attendance).length === attStudents.length;

  const TABS = [
    ...(inchargeClasses.length > 0 ? [{key: 'Attendance', icon: ClipboardDocumentCheckIcon}] : []),
    {key: 'Marks', icon: PencilSquareIcon},
    {key: 'Timetable', icon: CalendarDaysIcon},
    {key: 'My Classes', icon: BookOpenIcon},
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

      {/* TABS */}
      <View style={styles.tabRow}>
        {TABS.map(({key, icon: TabIcon}) => (
          <TouchableOpacity key={key}
            style={[styles.tab, tab === key && styles.tabOn]}
            onPress={() => setTab(key)}>
            <TabIcon size={15} color={tab === key ? '#7c3aed' : '#9ca3af'} />
            <Text style={[styles.tabTxt, tab === key && styles.tabTxtOn]}>{key}</Text>
          </TouchableOpacity>
        ))}
      </View>

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
                    <BookOpenIcon size={20} color="#7c3aed" />
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
              {loadingAtt ? (
                <ActivityIndicator color="#7c3aed" size="large" style={{marginTop: 30}} />
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
                              onPress={() => setAttendance(prev => ({...prev, [s.id]: btn.key}))}>
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
                  {testType === t.key && <CheckCircleIcon size={18} color="#7c3aed" />}
                </TouchableOpacity>
              ))}

              <Text style={[styles.sectionTitle, {marginTop: 20}]}>Total Marks</Text>
              <TextInput
                style={styles.marksInput}
                placeholder="e.g. 20"
                placeholderTextColor="#c4b5fd"
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
                  <BookOpenIcon size={40} color="#c4b5fd" />
                  <Text style={styles.emptyTxt}>No classes assigned</Text>
                </View>
              ) : (
                classes.map((cls, i) => (
                  <TouchableOpacity key={i} style={styles.classBtn}
                    onPress={() => loadMarksStudents(cls)}>
                    <View style={styles.classBtnLeft}>
                      <AcademicCapIcon size={20} color="#7c3aed" />
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
                <ActivityIndicator color="#7c3aed" size="large" style={{marginTop: 30}} />
              ) : (
                marksStudents.map((s, i) => {
                  const obtained = marks[s.id] || '';
                  const total = parseInt(totalMarks);
                  const pct = obtained ? Math.round((parseInt(obtained) / total) * 100) : 0;
                  const isOver = obtained && parseInt(obtained) > total;

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
                          {obtained ? `${pct}%` : 'Not entered'}
                        </Text>
                      </View>
                      <View style={styles.marksInputWrap}>
                        <TextInput
                          style={[styles.marksInputSmall, isOver && {borderColor: '#ef4444'}]}
                          placeholder="0"
                          placeholderTextColor="#c4b5fd"
                          keyboardType="number-pad"
                          value={obtained}
                          onChangeText={val => setMarks(prev => ({...prev, [s.id]: val}))}
                        />
                        <Text style={styles.marksTotal}>/{totalMarks}</Text>
                      </View>
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

      {/* ── MY CLASSES TAB ── */}
      {tab === 'Timetable' && (
        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>Class Timetable</Text>

          {/* Class selector — only assigned classes */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 12}}>
            {classes.map((cls, i) => (
              <TouchableOpacity key={i}
                style={{
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8,
                  backgroundColor: ttClass === cls ? '#059669' : '#ffffff',
                  borderWidth: 1, borderColor: ttClass === cls ? '#059669' : '#ede9fe',
                }}
                onPress={() => loadTeacherTimetable(cls)}>
                <Text style={{
                  fontSize: 12, fontWeight: '600',
                  color: ttClass === cls ? '#ffffff' : '#6b7280',
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
                      backgroundColor: ttDay === d ? '#1e1b4b' : '#ffffff',
                      borderWidth: 1, borderColor: ttDay === d ? '#1e1b4b' : '#ede9fe',
                    }}
                    onPress={() => setTtDay(d)}>
                    <Text style={{
                      fontSize: 12, fontWeight: '600',
                      color: ttDay === d ? '#ffffff' : '#6b7280',
                    }}>{d.slice(0, 3)}{d === 'Friday' ? ' 🕌' : ''}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {loadingTT && <ActivityIndicator color="#059669" style={{marginVertical: 20}} />}

              {!loadingTT && ttData && ttData[ttDay] ? (
                ttData[ttDay].map((t: any, i: number) => {
                  const isMine = t.teacher && teacher?.name &&
                    t.teacher.toLowerCase().includes(teacher.name.toLowerCase());
                  return (
                    <View key={i} style={{
                      backgroundColor: t.period === 0 ? '#f0fdf4' : isMine ? '#ecfdf5' : '#ffffff',
                      borderRadius: 14, padding: 14, marginBottom: 8,
                      borderWidth: isMine ? 1.5 : 1,
                      borderColor: t.period === 0 ? '#bbf7d0' : isMine ? '#059669' : '#ede9fe',
                      flexDirection: 'row', alignItems: 'center', gap: 12,
                    }}>
                      <View style={{minWidth: 90}}>
                        <Text style={{fontSize: 11, fontWeight: '700', color: '#059669'}}>{t.time}</Text>
                      </View>
                      <View style={{flex: 1}}>
                        <Text style={{
                          fontSize: 14, fontWeight: '600',
                          color: t.period === 0 ? '#16a34a' : '#1e1b4b',
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
              <BookOpenIcon size={40} color="#c4b5fd" />
              <Text style={styles.emptyTxt}>No classes assigned</Text>
            </View>
          ) : (
            classes.map((cls, i) => (
              <View key={i} style={styles.myClassCard}>
                <View style={styles.myClassLeft}>
                  <View style={[styles.myClassIcon,
                    inchargeClasses.includes(cls) && {backgroundColor: '#f0fdf4'}]}>
                    <BookOpenIcon size={20} color={inchargeClasses.includes(cls) ? '#16a34a' : '#7c3aed'} />
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
                      style={[styles.markBtn, {backgroundColor: '#1e1b4b'}]}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#faf5ff'},
  flex: {flex: 1},
  navbar: {
    backgroundColor: '#1e1b4b', paddingTop: 50, paddingBottom: 16,
    paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {fontSize: 20, fontWeight: '700', color: '#ffffff', letterSpacing: 2},
  brandAccent: {color: '#a78bfa'},
  navSub: {fontSize: 9, letterSpacing: 3, color: 'rgba(255,255,255,0.5)'},
  teacherCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#ffffff', padding: 14,
    borderBottomWidth: 1, borderBottomColor: '#ede9fe',
  },
  teacherAv: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#f5f3ff', borderWidth: 2, borderColor: '#7c3aed',
    alignItems: 'center', justifyContent: 'center',
  },
  teacherAvTxt: {fontSize: 13, fontWeight: '700', color: '#7c3aed'},
  teacherName: {fontSize: 15, fontWeight: '700', color: '#1e1b4b'},
  teacherMeta: {fontSize: 12, color: '#6b7280', marginTop: 1},
  tabRow: {
    flexDirection: 'row', backgroundColor: '#ffffff',
    borderBottomWidth: 1, borderBottomColor: '#ede9fe',
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabOn: {borderBottomColor: '#7c3aed'},
  tabTxt: {fontSize: 12, fontWeight: '500', color: '#9ca3af'},
  tabTxtOn: {color: '#7c3aed', fontWeight: '700'},
  content: {flex: 1, paddingHorizontal: 14, paddingTop: 14},
  sectionTitle: {fontSize: 17, fontWeight: '700', color: '#1e1b4b', marginBottom: 12},
  stepHeader: {flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12},
  emptyBox: {alignItems: 'center', paddingVertical: 40, gap: 10},
  emptyTxt: {fontSize: 15, fontWeight: '600', color: '#6b7280'},
  classBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#ffffff', borderRadius: 12, padding: 16,
    marginBottom: 8, borderWidth: 1, borderColor: '#ede9fe',
  },
  classBtnLeft: {flexDirection: 'row', alignItems: 'center', gap: 10},
  classBtnTxt: {fontSize: 15, fontWeight: '600', color: '#1e1b4b'},
  classBtnSub: {fontSize: 11, color: '#16a34a', fontWeight: '500', marginTop: 2},
  testTypeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#ffffff', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1.5, borderColor: '#ede9fe',
  },
  testTypeBtnOn: {borderColor: '#7c3aed', backgroundColor: '#f5f3ff'},
  testTypeTxt: {fontSize: 14, fontWeight: '500', color: '#6b7280'},
  testTypeTxtOn: {color: '#7c3aed', fontWeight: '700'},
  marksInput: {
    backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#ede9fe',
    borderRadius: 10, padding: 13, fontSize: 16, color: '#1e1b4b',
    fontWeight: '600', marginBottom: 16,
  },
  nextBtn: {
    backgroundColor: '#7c3aed', borderRadius: 10,
    padding: 15, alignItems: 'center', marginTop: 8,
  },
  nextBtnOff: {backgroundColor: '#c4b5fd'},
  nextBtnTxt: {color: '#ffffff', fontSize: 15, fontWeight: '700'},
  testSummary: {
    backgroundColor: '#f5f3ff', borderRadius: 10, padding: 12,
    marginBottom: 14, borderWidth: 1, borderColor: '#ede9fe',
  },
  testSummaryTxt: {fontSize: 13, color: '#7c3aed', fontWeight: '600'},
  classHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#ffffff', padding: 14,
    borderBottomWidth: 1, borderBottomColor: '#ede9fe',
  },
  backLink: {fontSize: 13, color: '#7c3aed', fontWeight: '600'},
  className: {fontSize: 16, fontWeight: '700', color: '#1e1b4b'},
  summaryRow: {
    flexDirection: 'row', gap: 8, padding: 12,
    backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#ede9fe',
  },
  summaryCard: {flex: 1, padding: 10, alignItems: 'center', borderRadius: 10, borderWidth: 1},
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
    backgroundColor: '#f5f3ff', borderWidth: 1.5, borderColor: '#ede9fe',
    alignItems: 'center', justifyContent: 'center',
  },
  avP: {backgroundColor: '#f0fdf4', borderColor: '#86efac'},
  avA: {backgroundColor: '#fef2f2', borderColor: '#fca5a5'},
  avL: {backgroundColor: '#fffbeb', borderColor: '#fcd34d'},
  studentAvTxt: {fontSize: 12, fontWeight: '700', color: '#7c3aed'},
  studentInfo: {flex: 1},
  studentName: {fontSize: 13, fontWeight: '600', color: '#1e1b4b'},
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
    width: 52, height: 40, borderWidth: 1.5, borderColor: '#ede9fe',
    borderRadius: 8, backgroundColor: '#f5f3ff',
    textAlign: 'center', fontSize: 14, fontWeight: '700', color: '#1e1b4b',
  },
  marksTotal: {fontSize: 13, color: '#9ca3af', fontWeight: '500'},
  submitBar: {
    padding: 14, backgroundColor: '#ffffff',
    borderTopWidth: 1, borderTopColor: '#ede9fe',
  },
  submitBtn: {backgroundColor: '#1e1b4b', borderRadius: 12, padding: 15, alignItems: 'center'},
  submitBtnOff: {backgroundColor: '#c4b5fd'},
  submitBtnTxt: {color: '#ffffff', fontSize: 15, fontWeight: '700'},
  successWrap: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30},
  successIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#f0fdf4', borderWidth: 2, borderColor: '#86efac',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  successTitle: {fontSize: 26, fontWeight: '700', color: '#1e1b4b', marginBottom: 8},
  successStats: {
    flexDirection: 'row', gap: 24, backgroundColor: '#ffffff',
    borderRadius: 16, padding: 20, marginBottom: 24,
    borderWidth: 1, borderColor: '#ede9fe',
  },
  sstat: {alignItems: 'center'},
  sstatVal: {fontSize: 28, fontWeight: '700'},
  sstatLbl: {fontSize: 12, color: '#6b7280', fontWeight: '500', marginTop: 2},
  backBtn: {
    backgroundColor: '#1e1b4b', borderRadius: 12,
    padding: 15, width: '100%', alignItems: 'center',
  },
  backBtnTxt: {color: '#ffffff', fontSize: 15, fontWeight: '700'},
  myClassCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#ffffff', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#ede9fe',
  },
  myClassLeft: {flexDirection: 'row', alignItems: 'center', gap: 12},
  myClassIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#f5f3ff', alignItems: 'center', justifyContent: 'center',
  },
  myClassName: {fontSize: 15, fontWeight: '700', color: '#1e1b4b'},
  myClassSub: {fontSize: 12, color: '#6b7280', marginTop: 2},
  myClassActions: {flexDirection: 'row', gap: 8},
  markBtn: {
    backgroundColor: '#7c3aed', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  markBtnTxt: {color: '#ffffff', fontSize: 12, fontWeight: '700'},
});
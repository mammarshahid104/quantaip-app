import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import {
  ClipboardDocumentCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowRightOnRectangleIcon,
  ChartBarIcon,
  BookOpenIcon,
  UserGroupIcon,
} from 'react-native-heroicons/outline';

const SCHOOL_CODE = 'GHS-001';

export default function TeacherScreen({navigation}: any) {
  const [teacher, setTeacher] = useState<any>(null);
  const [classes, setClasses] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<{[key: string]: string}>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [tab, setTab] = useState('Attendance');

  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  // Load teacher data
  useEffect(() => {
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
          setTeacher(doc.data());
          setClasses(doc.data()?.classesAssigned || []);
        }
      } catch (e) {}
    };
    loadTeacher();
  }, []);

  // Load students when class selected
  const loadStudents = async (cls: string) => {
    setSelectedClass(cls);
    setAttendance({});
    setSubmitted(false);
    setLoading(true);
    try {
      const snapshot = await firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('students')
        .where('class', '==', cls)
        .get();
      setStudents(snapshot.docs.map(d => d.data()));
    } catch (e) {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const mark = (id: string, status: string) => {
    setAttendance(prev => ({...prev, [id]: status}));
  };

  const submitAttendance = async () => {
    const unmarked = students.filter(s => !attendance[s.id]);
    if (unmarked.length > 0) {
      Alert.alert('Incomplete', `${unmarked.length} students not marked yet!`);
      return;
    }
    setSubmitting(true);
    try {
      const dateKey = new Date().toISOString().split('T')[0];
      const batch = firestore().batch();

      students.forEach(s => {
        const ref = firestore()
          .collection('schools').doc(SCHOOL_CODE)
          .collection('attendance').doc(dateKey)
          .collection(selectedClass).doc(s.id);
        batch.set(ref, {
          studentId: s.id,
          name: s.fullName || s.name,
          status: attendance[s.id],
          class: selectedClass,
          date: dateKey,
          markedBy: teacher?.id || 'teacher',
          markedAt: firestore.FieldValue.serverTimestamp(),
        });
      });

      await batch.commit();
      setSubmitted(true);
      Alert.alert('Submitted ✅', `Attendance for ${selectedClass} saved successfully!`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const present = Object.values(attendance).filter(v => v === 'P').length;
  const absent = Object.values(attendance).filter(v => v === 'A').length;
  const late = Object.values(attendance).filter(v => v === 'L').length;
  const allMarked = students.length > 0 && Object.keys(attendance).length === students.length;

  return (
    <View style={styles.root}>

      {/* NAVBAR */}
      <View style={styles.navbar}>
        <View>
          <Text style={styles.brand}>QUANT<Text style={styles.brandAccent}>AIP</Text></Text>
          <Text style={styles.navSub}>TEACHER PANEL</Text>
        </View>
        <TouchableOpacity
          onPress={() => {auth().signOut(); navigation.navigate('Login');}}>
          <ArrowRightOnRectangleIcon size={22} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>

      {/* TABS */}
      <View style={styles.tabRow}>
        {['Attendance', 'My Classes'].map(t => (
          <TouchableOpacity key={t}
            style={[styles.tab, tab === t && styles.tabOn]}
            onPress={() => setTab(t)}>
            {t === 'Attendance'
              ? <ClipboardDocumentCheckIcon size={15} color={tab === t ? '#7c3aed' : '#9ca3af'} />
              : <BookOpenIcon size={15} color={tab === t ? '#7c3aed' : '#9ca3af'} />}
            <Text style={[styles.tabTxt, tab === t && styles.tabTxtOn]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── ATTENDANCE TAB ── */}
      {tab === 'Attendance' && (
        <View style={styles.flex}>

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

          {/* Class selector */}
          {!selectedClass ? (
            <ScrollView style={styles.content}>
              <Text style={styles.sectionTitle}>Select Class</Text>
              {classes.length === 0 ? (
                <View style={styles.emptyBox}>
                  <UserGroupIcon size={40} color="#c4b5fd" />
                  <Text style={styles.emptyTxt}>No classes assigned yet</Text>
                  <Text style={styles.emptySubTxt}>Contact admin to assign classes</Text>
                </View>
              ) : (
                classes.map((cls, i) => (
                  <TouchableOpacity key={i} style={styles.classBtn}
                    onPress={() => loadStudents(cls)}>
                    <View style={styles.classBtnLeft}>
                      <BookOpenIcon size={20} color="#7c3aed" />
                      <Text style={styles.classBtnTxt}>{cls}</Text>
                    </View>
                    <ClipboardDocumentCheckIcon size={18} color="#9ca3af" />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          ) : submitted ? (
            // Success screen
            <View style={styles.successWrap}>
              <View style={styles.successIcon}>
                <CheckCircleIcon size={48} color="#16a34a" />
              </View>
              <Text style={styles.successTitle}>Submitted!</Text>
              <Text style={styles.successSub}>
                Attendance for {selectedClass} saved.{'\n'}
                Parents of absent students will be notified.
              </Text>
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
                onPress={() => {setSelectedClass(''); setStudents([]); setAttendance({}); setSubmitted(false);}}>
                <Text style={styles.backBtnTxt}>Mark Another Class</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.flex}>
              {/* Class header */}
              <View style={styles.classHeader}>
                <TouchableOpacity onPress={() => {setSelectedClass(''); setStudents([]); setAttendance({});}}>
                  <Text style={styles.backLink}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.className}>{selectedClass}</Text>
              </View>

              {/* Summary */}
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

              {/* Student list */}
              {loading ? (
                <ActivityIndicator color="#7c3aed" size="large" style={{marginTop: 30}} />
              ) : (
                <ScrollView style={styles.content}>
                  {students.map((s, i) => {
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
                            {key: 'P', label: 'P', activeColor: '#16a34a', activeBg: '#f0fdf4', activeBorder: '#86efac'},
                            {key: 'A', label: 'A', activeColor: '#ef4444', activeBg: '#fef2f2', activeBorder: '#fca5a5'},
                            {key: 'L', label: 'L', activeColor: '#f59e0b', activeBg: '#fffbeb', activeBorder: '#fcd34d'},
                          ].map(btn => (
                            <TouchableOpacity key={btn.key}
                              style={[styles.attBtn,
                                status === btn.key && {
                                  backgroundColor: btn.activeBg,
                                  borderColor: btn.activeBorder,
                                }
                              ]}
                              onPress={() => mark(s.id, btn.key)}>
                              <Text style={[styles.attBtnTxt,
                                status === btn.key && {color: btn.activeColor, fontWeight: '700'}
                              ]}>{btn.label}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    );
                  })}
                  <View style={{height: 100}} />
                </ScrollView>
              )}

              {/* Submit bar */}
              <View style={styles.submitBar}>
                <TouchableOpacity
                  style={[styles.submitBtn, !allMarked && styles.submitBtnOff]}
                  disabled={!allMarked || submitting}
                  onPress={submitAttendance}>
                  {submitting ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <View style={styles.btnInner}>
                      <ClipboardDocumentCheckIcon size={18} color="#ffffff" />
                      <Text style={styles.submitBtnTxt}>
                        {allMarked
                          ? 'Submit Attendance'
                          : `Mark all (${Object.keys(attendance).length}/${students.length})`}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* ── MY CLASSES TAB ── */}
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
                  <View style={styles.myClassIcon}>
                    <BookOpenIcon size={20} color="#7c3aed" />
                  </View>
                  <View>
                    <Text style={styles.myClassName}>{cls}</Text>
                    <Text style={styles.myClassSub}>{teacher?.subject}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.markBtn}
                  onPress={() => {setTab('Attendance'); loadStudents(cls);}}>
                  <Text style={styles.markBtnTxt}>Mark</Text>
                </TouchableOpacity>
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
  tabRow: {
    flexDirection: 'row', backgroundColor: '#ffffff',
    borderBottomWidth: 1, borderBottomColor: '#ede9fe',
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabOn: {borderBottomColor: '#7c3aed'},
  tabTxt: {fontSize: 13, fontWeight: '500', color: '#9ca3af'},
  tabTxtOn: {color: '#7c3aed', fontWeight: '700'},
  content: {flex: 1, paddingHorizontal: 14, paddingTop: 14},
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
  sectionTitle: {fontSize: 17, fontWeight: '700', color: '#1e1b4b', marginBottom: 12},
  emptyBox: {alignItems: 'center', paddingVertical: 40, gap: 10},
  emptyTxt: {fontSize: 15, fontWeight: '600', color: '#6b7280'},
  emptySubTxt: {fontSize: 13, color: '#9ca3af'},
  classBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#ffffff', borderRadius: 12, padding: 16,
    marginBottom: 8, borderWidth: 1, borderColor: '#ede9fe',
  },
  classBtnLeft: {flexDirection: 'row', alignItems: 'center', gap: 10},
  classBtnTxt: {fontSize: 15, fontWeight: '600', color: '#1e1b4b'},
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
  submitBar: {
    padding: 14, backgroundColor: '#ffffff',
    borderTopWidth: 1, borderTopColor: '#ede9fe',
  },
  submitBtn: {backgroundColor: '#1e1b4b', borderRadius: 12, padding: 15, alignItems: 'center'},
  submitBtnOff: {backgroundColor: '#c4b5fd'},
  btnInner: {flexDirection: 'row', alignItems: 'center', gap: 8},
  submitBtnTxt: {color: '#ffffff', fontSize: 15, fontWeight: '700'},
  successWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30,
  },
  successIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#f0fdf4', borderWidth: 2, borderColor: '#86efac',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  successTitle: {fontSize: 26, fontWeight: '700', color: '#1e1b4b', marginBottom: 8},
  successSub: {fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 22, marginBottom: 24},
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
  markBtn: {
    backgroundColor: '#7c3aed', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  markBtnTxt: {color: '#ffffff', fontSize: 13, fontWeight: '700'},
});
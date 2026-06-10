import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import {
  UserIcon,
  AcademicCapIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowRightOnRectangleIcon,
  BookOpenIcon,
  TrophyIcon,
} from 'react-native-heroicons/outline';

const SCHOOL_CODE = 'GHS-001';
const TABS = ['Overview', 'Attendance', 'Grades', 'Results', 'Timetable'];

const TEST_TYPE_ORDER = ['weekly', 'monthly', 'midterm', 'sendup', 'final', 'classtest'];
const TEST_TYPE_LABELS: any = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  midterm: 'Mid Term',
  sendup: 'Send Up',
  final: 'Final',
  classtest: 'Class Test',
};

export default function StudentScreen({navigation}: any) {
  const [tab, setTab] = useState('Overview');
  const [student, setStudent] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [marks, setMarks] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMarks, setLoadingMarks] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);

  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  useEffect(() => {loadStudent();}, []);

  const loadStudent = async () => {
    try {
      const user = auth().currentUser;
      if (!user) return;
      const id = user.email?.split('@')[0].toUpperCase();
      const doc = await firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('students').doc(id)
        .get();
      if (doc.exists) {
        setStudent(doc.data());
        loadAttendance(doc.data());
      }
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  const loadAttendance = (studentData: any) => {
    // NAYA TAREEQA: koi extra Firestore read nahi!
    // attendanceMap pehle se student ke doc mein hai (1 read mein aa chuka)
    const map = studentData?.attendanceMap || {};
    const records = Object.keys(map).map(date => ({
      date,
      status: map[date],
      class: studentData?.class,
    }));
    setAttendance(records.sort((a, b) => b.date.localeCompare(a.date)));
  };

  const loadMarks = async () => {
    if (!student) return;
    setLoadingMarks(true);
    try {
      const testsSnap = await firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('marks')
        .get();
      const allMarks: any[] = [];
      for (const testDoc of testsSnap.docs) {
        const testData = testDoc.data();
        if (testData.class !== student.class) continue;
        const studentMarkDoc = await firestore()
          .collection('schools').doc(SCHOOL_CODE)
          .collection('marks').doc(testDoc.id)
          .collection('students').doc(student.id)
          .get();
        if (studentMarkDoc.exists) {
          allMarks.push({...testData, ...studentMarkDoc.data()});
        }
      }
      setMarks(allMarks.sort((a, b) => b.date?.localeCompare(a.date)));
    } catch (e) {
      console.log('Marks error:', e);
    } finally {
      setLoadingMarks(false);
    }
  };

  const loadResults = async () => {
    if (!student) return;
    setLoadingResults(true);
    try {
      const resultsSnap = await firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('results')
        .get();
      const myResults: any[] = [];
      for (const resultDoc of resultsSnap.docs) {
        const resultData = resultDoc.data();
        if (resultData.class !== student.class) continue;
        const studentResult = await firestore()
          .collection('schools').doc(SCHOOL_CODE)
          .collection('results').doc(resultDoc.id)
          .collection('students').doc(student.id)
          .get();
        if (studentResult.exists) {
          myResults.push({...resultData, ...studentResult.data()});
        }
      }
      setResults(myResults);
    } catch (e) {
    } finally {
      setLoadingResults(false);
    }
  };

  useEffect(() => {
    if (tab === 'Grades' && student) loadMarks();
    if (tab === 'Results' && student) loadResults();
  }, [tab, student]);

  const marksBySubject = marks.reduce((acc: any, m) => {
    const subj = m.subject || 'Unknown';
    if (!acc[subj]) acc[subj] = [];
    acc[subj].push(m);
    return acc;
  }, {});

  const allPercentages = marks.map(m => m.percentage || 0);
  const overallAvg = allPercentages.length > 0
    ? Math.round(allPercentages.reduce((a, b) => a + b, 0) / allPercentages.length)
    : 0;

  const overallGrade = overallAvg >= 90 ? 'A+' : overallAvg >= 80 ? 'A' :
    overallAvg >= 70 ? 'B+' : overallAvg >= 60 ? 'B' :
    overallAvg >= 50 ? 'C' : overallAvg > 0 ? 'F' : '-';

  const gradeColor = (pct: number) =>
    pct >= 80 ? '#16a34a' : pct >= 60 ? '#7c3aed' : pct >= 40 ? '#f59e0b' : '#ef4444';

  const present = attendance.filter(a => a.status === 'P').length;
  const absent = attendance.filter(a => a.status === 'A').length;
  const late = attendance.filter(a => a.status === 'L').length;
  const total = attendance.length;
  const attendancePct = total > 0 ? Math.round((present / total) * 100) : 0;

  const TIMETABLE = [
    {time: '08:00', subject: 'Mathematics', teacher: 'Mr. Qaiser', room: 'Rm 12'},
    {time: '08:45', subject: 'English', teacher: 'Ms. Fatima', room: 'Rm 4'},
    {time: '09:30', subject: 'Physics', teacher: 'Mr. Arif', room: 'Rm 7'},
    {time: '10:15', subject: 'Break', teacher: '', room: ''},
    {time: '10:30', subject: 'Urdu', teacher: 'Ms. Nadia', room: 'Rm 2'},
    {time: '11:15', subject: 'Biology', teacher: 'Ms. Sana', room: 'Rm 9'},
    {time: '12:00', subject: 'Lunch', teacher: '', room: ''},
    {time: '12:45', subject: 'Pak Studies', teacher: 'Mr. Bilal', room: 'Rm 5'},
  ];

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#7c3aed" />
        <Text style={styles.loadingTxt}>Loading your profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>

      {/* NAVBAR */}
      <View style={styles.navbar}>
        <View>
          <Text style={styles.brand}>QUANT<Text style={styles.brandAccent}>AIP</Text></Text>
          <Text style={styles.navSub}>STUDENT PORTAL</Text>
        </View>
        <TouchableOpacity onPress={() => {auth().signOut(); navigation.navigate('Login');}}>
          <ArrowRightOnRectangleIcon size={22} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>

      {/* HERO */}
      <View style={styles.hero}>
        <View style={styles.heroAv}>
          <Text style={styles.heroAvTxt}>
            {student?.fullName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || 'ST'}
          </Text>
        </View>
        <View style={styles.heroInfo}>
          <Text style={styles.heroName}>{student?.fullName || 'Student'}</Text>
          <Text style={styles.heroMeta}>
            {student?.class} — {student?.section} · Roll {student?.rollNo || 'N/A'}
          </Text>
          <Text style={styles.heroId}>{student?.id}</Text>
        </View>
        <View style={[styles.heroBadge,
          {backgroundColor: attendancePct >= 75 ? '#f0fdf4' : '#fef2f2',
           borderColor: attendancePct >= 75 ? '#86efac' : '#fca5a5'}]}>
          <Text style={[styles.heroBadgeVal,
            {color: attendancePct >= 75 ? '#16a34a' : '#ef4444'}]}>
            {attendancePct}%
          </Text>
          <Text style={styles.heroBadgeLbl}>Attend.</Text>
        </View>
      </View>

      {/* TABS */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#ede9fe', maxHeight: 44}}>
        <View style={{flexDirection: 'row'}}>
          {TABS.map(t => (
            <TouchableOpacity key={t}
              style={[styles.tab, tab === t && styles.tabOn]}
              onPress={() => setTab(t)}>
              <Text style={[styles.tabTxt, tab === t && styles.tabTxtOn]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <ScrollView style={styles.content}>

        {/* OVERVIEW */}
        {tab === 'Overview' && (
          <View>
            <View style={styles.statsRow}>
              <View style={[styles.statCard, {backgroundColor: '#f0fdf4', borderColor: '#bbf7d0'}]}>
                <CheckCircleIcon size={18} color="#16a34a" />
                <Text style={[styles.statVal, {color: '#16a34a'}]}>{present}</Text>
                <Text style={styles.statLbl}>Present</Text>
              </View>
              <View style={[styles.statCard, {backgroundColor: '#fef2f2', borderColor: '#fecaca'}]}>
                <XCircleIcon size={18} color="#ef4444" />
                <Text style={[styles.statVal, {color: '#ef4444'}]}>{absent}</Text>
                <Text style={styles.statLbl}>Absent</Text>
              </View>
              <View style={[styles.statCard, {backgroundColor: '#f5f3ff', borderColor: '#ddd6fe'}]}>
                <TrophyIcon size={18} color="#7c3aed" />
                <Text style={[styles.statVal, {color: '#7c3aed'}]}>{overallGrade}</Text>
                <Text style={styles.statLbl}>Grade</Text>
              </View>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Profile</Text>
              {[
                {label: 'Full Name', value: student?.fullName, icon: UserIcon},
                {label: 'Father Name', value: student?.fatherName || 'N/A', icon: UserIcon},
                {label: 'Class', value: `${student?.class} — ${student?.section}`, icon: AcademicCapIcon},
                {label: 'Roll No', value: student?.rollNo || 'N/A', icon: ChartBarIcon},
                {label: 'Date of Birth', value: student?.dob || 'N/A', icon: CalendarDaysIcon},
                {label: 'School', value: student?.school, icon: BookOpenIcon},
              ].map((item, i) => (
                <View key={i} style={styles.profileRow}>
                  <item.icon size={14} color="#7c3aed" />
                  <Text style={styles.profileLabel}>{item.label}</Text>
                  <Text style={styles.profileValue}>{item.value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ATTENDANCE */}
        {tab === 'Attendance' && (
          <View>
            <View style={styles.attSummary}>
              <Text style={styles.attPct}>{attendancePct}%</Text>
              <Text style={styles.attLabel}>Overall Attendance</Text>
              <View style={styles.attBar}>
                <View style={[styles.attBarFill, {
                  width: `${attendancePct}%`,
                  backgroundColor: attendancePct >= 75 ? '#16a34a' : '#ef4444',
                }]} />
              </View>
              <View style={styles.attStats}>
                <Text style={styles.attStat}>✅ {present} Present</Text>
                <Text style={styles.attStat}>❌ {absent} Absent</Text>
                <Text style={styles.attStat}>⏰ {late} Late</Text>
              </View>
            </View>
            {attendance.length === 0 ? (
              <View style={styles.emptyBox}>
                <CalendarDaysIcon size={40} color="#c4b5fd" />
                <Text style={styles.emptyTxt}>No attendance records yet</Text>
              </View>
            ) : (
              attendance.map((a, i) => (
                <View key={i} style={styles.attRow}>
                  <View style={styles.attDateBox}>
                    <Text style={styles.attDate}>{a.date}</Text>
                  </View>
                  <Text style={styles.attClass}>{a.class}</Text>
                  <Text style={[styles.attStatusTxt,
                    a.status === 'P' && {color: '#16a34a'},
                    a.status === 'A' && {color: '#ef4444'},
                    a.status === 'L' && {color: '#f59e0b'},
                  ]}>
                    {a.status === 'P' ? '✅ Present' : a.status === 'A' ? '❌ Absent' : '⏰ Late'}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}

        {/* GRADES */}
        {tab === 'Grades' && (
          <View>
            <View style={styles.gpaBanner}>
              <View>
                <Text style={styles.gpaEye}>OVERALL PERFORMANCE</Text>
                <Text style={styles.gpaVal}>{overallAvg}%</Text>
                <Text style={styles.gpaGrade}>Grade {overallGrade}</Text>
              </View>
              <View style={styles.rankBox}>
                <TrophyIcon size={24} color="#a78bfa" />
                <Text style={styles.rankVal}>{marks.length}</Text>
                <Text style={styles.rankLbl}>Tests</Text>
              </View>
            </View>
            {loadingMarks ? (
              <ActivityIndicator color="#7c3aed" size="large" style={{marginTop: 20}} />
            ) : marks.length === 0 ? (
              <View style={styles.emptyBox}>
                <ChartBarIcon size={40} color="#c4b5fd" />
                <Text style={styles.emptyTxt}>No marks yet</Text>
                <Text style={styles.emptySubTxt}>Marks will appear after tests</Text>
              </View>
            ) : (
              Object.keys(marksBySubject).map((subject, si) => {
                const subjectMarks = marksBySubject[subject];
                const subjectAvg = Math.round(
                  subjectMarks.reduce((a: number, m: any) => a + (m.percentage || 0), 0) / subjectMarks.length
                );
                const col = gradeColor(subjectAvg);
                return (
                  <View key={si} style={styles.subjectBlock}>
                    <View style={styles.subjectHeader}>
                      <Text style={styles.subjectName}>{subject}</Text>
                      <View style={[styles.subjectAvgPill, {backgroundColor: col + '20', borderColor: col}]}>
                        <Text style={[styles.subjectAvgTxt, {color: col}]}>{subjectAvg}%</Text>
                      </View>
                    </View>
                    <View style={styles.subjectBar}>
                      <View style={[styles.subjectBarFill, {width: `${subjectAvg}%`, backgroundColor: col}]} />
                    </View>
                    {subjectMarks
                      .sort((a: any, b: any) => TEST_TYPE_ORDER.indexOf(a.testType) - TEST_TYPE_ORDER.indexOf(b.testType))
                      .map((m: any, mi: number) => (
                        <View key={mi} style={styles.testRow}>
                          <View style={[styles.testTypeBadge, {backgroundColor: gradeColor(m.percentage) + '15'}]}>
                            <Text style={[styles.testTypeTxt, {color: gradeColor(m.percentage)}]}>
                              {TEST_TYPE_LABELS[m.testType] || m.testType}
                            </Text>
                          </View>
                          <Text style={styles.testDate}>{m.date}</Text>
                          <Text style={styles.testMarks}>{m.obtained}/{m.total}</Text>
                          <View style={[styles.gradePill, {
                            backgroundColor: gradeColor(m.percentage) + '20',
                            borderColor: gradeColor(m.percentage),
                          }]}>
                            <Text style={[styles.gradePillTxt, {color: gradeColor(m.percentage)}]}>
                              {m.grade}
                            </Text>
                          </View>
                        </View>
                      ))}
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* RESULTS */}
        {tab === 'Results' && (
          <View>
            <View style={styles.gpaBanner}>
              <View>
                <Text style={styles.gpaEye}>RESULT CARD</Text>
                <Text style={[styles.gpaVal, {fontSize: 22}]}>{student?.fullName}</Text>
                <Text style={styles.gpaGrade}>{student?.class} — {student?.section}</Text>
              </View>
              <View style={styles.rankBox}>
                <TrophyIcon size={24} color="#a78bfa" />
                <Text style={styles.rankVal}>{results.length}</Text>
                <Text style={styles.rankLbl}>Results</Text>
              </View>
            </View>
            {loadingResults ? (
              <ActivityIndicator color="#7c3aed" size="large" style={{marginTop: 20}} />
            ) : results.length === 0 ? (
              <View style={styles.emptyBox}>
                <TrophyIcon size={40} color="#c4b5fd" />
                <Text style={styles.emptyTxt}>No results yet</Text>
                <Text style={styles.emptySubTxt}>Results will appear after admin generates them</Text>
              </View>
            ) : (
              results.map((r, i) => (
                <View key={i} style={styles.card}>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
                    <View>
                      <Text style={{fontSize: 15, fontWeight: '700', color: '#1e1b4b'}}>
                        {r.testType?.charAt(0).toUpperCase() + r.testType?.slice(1)} Result
                      </Text>
                      <Text style={{fontSize: 11, color: '#9ca3af', marginTop: 2}}>
                        {r.generatedAt?.toDate?.()?.toLocaleDateString?.() || ''}
                      </Text>
                    </View>
                    <View style={{
                      backgroundColor: r.position <= 3 ? '#fffbeb' : '#f5f3ff',
                      borderRadius: 10, padding: 10, alignItems: 'center',
                      borderWidth: 1,
                      borderColor: r.position <= 3 ? '#fcd34d' : '#c4b5fd',
                    }}>
                      <Text style={{fontSize: 18, fontWeight: '700', color: r.position <= 3 ? '#f59e0b' : '#7c3aed'}}>
                        #{r.position}
                      </Text>
                      <Text style={{fontSize: 10, color: '#9ca3af'}}>Position</Text>
                    </View>
                  </View>
                  {r.subjects && Object.keys(r.subjects).map((subj, si) => (
                    <View key={si} style={{
                      flexDirection: 'row', justifyContent: 'space-between',
                      alignItems: 'center', paddingVertical: 8,
                      borderTopWidth: 1, borderTopColor: '#f3f4f6',
                    }}>
                      <Text style={{fontSize: 13, color: '#374151', fontWeight: '500'}}>{subj}</Text>
                      <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                        <Text style={{fontSize: 13, fontWeight: '600', color: '#1e1b4b'}}>
                          {r.subjects[subj].obtained}/{r.subjects[subj].total}
                        </Text>
                        <View style={{
                          backgroundColor: r.subjects[subj].grade === 'A+' ? '#f0fdf4' :
                            r.subjects[subj].grade === 'F' ? '#fef2f2' : '#f5f3ff',
                          borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
                        }}>
                          <Text style={{
                            fontSize: 11, fontWeight: '700',
                            color: r.subjects[subj].grade === 'A+' ? '#16a34a' :
                              r.subjects[subj].grade === 'F' ? '#ef4444' : '#7c3aed',
                          }}>{r.subjects[subj].grade}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                  <View style={{
                    flexDirection: 'row', justifyContent: 'space-between',
                    alignItems: 'center', marginTop: 10, paddingTop: 10,
                    borderTopWidth: 2, borderTopColor: '#ede9fe',
                  }}>
                    <Text style={{fontSize: 14, fontWeight: '700', color: '#1e1b4b'}}>Total</Text>
                    <View style={{alignItems: 'flex-end'}}>
                      <Text style={{fontSize: 16, fontWeight: '700', color: '#7c3aed'}}>
                        {r.totalObtained}/{r.totalMarks}
                      </Text>
                      <Text style={{fontSize: 12, color: '#6b7280'}}>{r.percentage}% · Grade {r.grade}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* TIMETABLE */}
        {tab === 'Timetable' && (
          <View>
            <Text style={styles.ttDay}>Today — {today}</Text>
            {TIMETABLE.map((t, i) => (
              <View key={i} style={[
                styles.ttCard,
                (t.subject === 'Break' || t.subject === 'Lunch') && styles.ttBreak,
              ]}>
                <View style={styles.ttTimeCol}>
                  <Text style={styles.ttTime}>{t.time}</Text>
                </View>
                <View style={styles.ttBody}>
                  <Text style={[styles.ttSubject,
                    (t.subject === 'Break' || t.subject === 'Lunch') && {color: '#9ca3af'}
                  ]}>{t.subject}</Text>
                  {t.teacher ? <Text style={styles.ttMeta}>{t.teacher} · {t.room}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{height: 30}} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#faf5ff'},
  loadingWrap: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12},
  loadingTxt: {fontSize: 14, color: '#7c3aed', fontWeight: '500'},
  navbar: {
    backgroundColor: '#1e1b4b', paddingTop: 50, paddingBottom: 16,
    paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {fontSize: 20, fontWeight: '700', color: '#ffffff', letterSpacing: 2},
  brandAccent: {color: '#a78bfa'},
  navSub: {fontSize: 9, letterSpacing: 3, color: 'rgba(255,255,255,0.5)'},
  hero: {
    backgroundColor: '#ffffff', flexDirection: 'row', alignItems: 'center',
    padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: '#ede9fe',
  },
  heroAv: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#f5f3ff', borderWidth: 2, borderColor: '#7c3aed',
    alignItems: 'center', justifyContent: 'center',
  },
  heroAvTxt: {fontSize: 14, fontWeight: '700', color: '#7c3aed'},
  heroInfo: {flex: 1},
  heroName: {fontSize: 15, fontWeight: '700', color: '#1e1b4b'},
  heroMeta: {fontSize: 11, color: '#6b7280', marginTop: 2},
  heroId: {fontSize: 10, color: '#c4b5fd', marginTop: 1},
  heroBadge: {borderWidth: 1, borderRadius: 10, padding: 8, alignItems: 'center'},
  heroBadgeVal: {fontSize: 16, fontWeight: '700'},
  heroBadgeLbl: {fontSize: 9, color: '#6b7280', fontWeight: '500', marginTop: 1},
  tab: {paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: 'transparent'},
  tabOn: {borderBottomColor: '#7c3aed'},
  tabTxt: {fontSize: 12, fontWeight: '500', color: '#9ca3af'},
  tabTxtOn: {color: '#7c3aed', fontWeight: '700'},
  content: {flex: 1, paddingHorizontal: 14, paddingTop: 14},
  statsRow: {flexDirection: 'row', gap: 8, marginBottom: 14},
  statCard: {flex: 1, borderRadius: 12, padding: 12, alignItems: 'center', gap: 4, borderWidth: 1},
  statVal: {fontSize: 20, fontWeight: '700'},
  statLbl: {fontSize: 11, color: '#6b7280', fontWeight: '500'},
  card: {backgroundColor: '#ffffff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#ede9fe', marginBottom: 14},
  cardTitle: {fontSize: 15, fontWeight: '700', color: '#1e1b4b', marginBottom: 12},
  profileRow: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#f3f4f6'},
  profileLabel: {fontSize: 12, color: '#6b7280', fontWeight: '500', width: 80},
  profileValue: {fontSize: 13, color: '#1e1b4b', fontWeight: '600', flex: 1},
  attSummary: {backgroundColor: '#1e1b4b', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 14},
  attPct: {fontSize: 40, fontWeight: '700', color: '#ffffff'},
  attLabel: {fontSize: 13, color: '#a78bfa', marginTop: 4, marginBottom: 12},
  attBar: {width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden'},
  attBarFill: {height: '100%', borderRadius: 3},
  attStats: {flexDirection: 'row', gap: 16, marginTop: 12},
  attStat: {fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '500'},
  emptyBox: {alignItems: 'center', paddingVertical: 40, gap: 8},
  emptyTxt: {fontSize: 14, color: '#9ca3af', fontWeight: '500'},
  emptySubTxt: {fontSize: 12, color: '#c4b5fd'},
  attRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#ffffff', borderRadius: 10, padding: 12,
    marginBottom: 6, borderWidth: 1, borderColor: '#ede9fe',
  },
  attDateBox: {backgroundColor: '#f5f3ff', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4},
  attDate: {fontSize: 11, fontWeight: '600', color: '#7c3aed'},
  attClass: {flex: 1, fontSize: 12, color: '#6b7280', fontWeight: '500', marginLeft: 8},
  attStatusTxt: {fontSize: 12, fontWeight: '600'},
  gpaBanner: {
    backgroundColor: '#1e1b4b', borderRadius: 16, padding: 20,
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  gpaEye: {fontSize: 10, letterSpacing: 2, color: '#a78bfa', fontWeight: '600', marginBottom: 4},
  gpaVal: {fontSize: 36, fontWeight: '700', color: '#ffffff'},
  gpaGrade: {fontSize: 14, color: '#a78bfa', fontWeight: '600', marginTop: 2},
  rankBox: {
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12,
    padding: 16, alignItems: 'center', gap: 4,
  },
  rankVal: {fontSize: 22, fontWeight: '700', color: '#ffffff'},
  rankLbl: {fontSize: 10, color: '#a78bfa', fontWeight: '500'},
  subjectBlock: {
    backgroundColor: '#ffffff', borderRadius: 14, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: '#ede9fe',
  },
  subjectHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8},
  subjectName: {fontSize: 15, fontWeight: '700', color: '#1e1b4b'},
  subjectAvgPill: {borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3},
  subjectAvgTxt: {fontSize: 12, fontWeight: '700'},
  subjectBar: {height: 4, backgroundColor: '#f3f4f6', borderRadius: 2, overflow: 'hidden', marginBottom: 12},
  subjectBarFill: {height: '100%', borderRadius: 2},
  testRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6',
  },
  testTypeBadge: {borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3},
  testTypeTxt: {fontSize: 11, fontWeight: '600'},
  testDate: {flex: 1, fontSize: 11, color: '#9ca3af'},
  testMarks: {fontSize: 13, fontWeight: '700', color: '#1e1b4b'},
  gradePill: {borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2},
  gradePillTxt: {fontSize: 10, fontWeight: '700'},
  ttDay: {fontSize: 14, fontWeight: '600', color: '#6b7280', marginBottom: 10},
  ttCard: {
    flexDirection: 'row', backgroundColor: '#ffffff',
    borderRadius: 10, marginBottom: 6, overflow: 'hidden',
    borderWidth: 1, borderColor: '#ede9fe',
  },
  ttBreak: {opacity: 0.5},
  ttTimeCol: {
    width: 54, padding: 12, alignItems: 'center',
    justifyContent: 'center', borderRightWidth: 1, borderRightColor: '#f3f4f6',
  },
  ttTime: {fontSize: 11, fontWeight: '600', color: '#6b7280'},
  ttBody: {flex: 1, padding: 12},
  ttSubject: {fontSize: 14, fontWeight: '700', color: '#1e1b4b'},
  ttMeta: {fontSize: 11, color: '#9ca3af', marginTop: 2},
});
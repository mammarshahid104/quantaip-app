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
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowRightOnRectangleIcon,
  BookOpenIcon,
} from 'react-native-heroicons/outline';

const SCHOOL_CODE = 'GHS-001';

const TABS = ['Overview', 'Attendance', 'Grades', 'Timetable'];

export default function StudentScreen({navigation}: any) {
  const [tab, setTab] = useState('Overview');
  const [student, setStudent] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  useEffect(() => {
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
        }
      } catch (e) {
      } finally {
        setLoading(false);
      }
    };
    loadStudent();
  }, []);

  useEffect(() => {
    if (!student) return;
    const loadAttendance = async () => {
      try {
        const snapshot = await firestore()
          .collection('schools').doc(SCHOOL_CODE)
          .collection('attendance')
          .get();

        const records: any[] = [];
        for (const dateDoc of snapshot.docs) {
          const classSnap = await firestore()
            .collection('schools').doc(SCHOOL_CODE)
            .collection('attendance').doc(dateDoc.id)
            .collection(student.class).doc(student.id)
            .get();
          if (classSnap.exists) {
            records.push({date: dateDoc.id, ...classSnap.data()});
          }
        }
        setAttendance(records.sort((a, b) => b.date.localeCompare(a.date)));
      } catch (e) {}
    };
    loadAttendance();
  }, [student]);

  const present = attendance.filter(a => a.status === 'P').length;
  const absent = attendance.filter(a => a.status === 'A').length;
  const late = attendance.filter(a => a.status === 'L').length;
  const total = attendance.length;
  const attendancePct = total > 0 ? Math.round((present / total) * 100) : 0;

  const GRADES = [
    {subject: 'Mathematics', score: 88, total: 100},
    {subject: 'English', score: 91, total: 100},
    {subject: 'Physics', score: 76, total: 100},
    {subject: 'Urdu', score: 84, total: 100},
    {subject: 'Pak Studies', score: 61, total: 100},
    {subject: 'Biology', score: 79, total: 100},
  ];

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

  const gradeColor = (s: number) =>
    s >= 85 ? '#16a34a' : s >= 70 ? '#7c3aed' : s >= 55 ? '#f59e0b' : '#ef4444';

  const gradeLabel = (s: number) =>
    s >= 90 ? 'A+' : s >= 80 ? 'A' : s >= 70 ? 'B+' : s >= 60 ? 'B' : 'C';

  const statusIcon = (status: string) => {
    if (status === 'P') return <CheckCircleIcon size={16} color="#16a34a" />;
    if (status === 'A') return <XCircleIcon size={16} color="#ef4444" />;
    if (status === 'L') return <ClockIcon size={16} color="#f59e0b" />;
    return null;
  };

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
        <TouchableOpacity
          onPress={() => {auth().signOut(); navigation.navigate('Login');}}>
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
      <View style={styles.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity key={t}
            style={[styles.tab, tab === t && styles.tabOn]}
            onPress={() => setTab(t)}>
            <Text style={[styles.tabTxt, tab === t && styles.tabTxtOn]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content}>

        {/* OVERVIEW */}
        {tab === 'Overview' && (
          <View>
            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={[styles.statCard, {backgroundColor: '#f0fdf4', borderColor: '#bbf7d0'}]}>
                <CheckCircleIcon size={20} color="#16a34a" />
                <Text style={[styles.statVal, {color: '#16a34a'}]}>{present}</Text>
                <Text style={styles.statLbl}>Present</Text>
              </View>
              <View style={[styles.statCard, {backgroundColor: '#fef2f2', borderColor: '#fecaca'}]}>
                <XCircleIcon size={20} color="#ef4444" />
                <Text style={[styles.statVal, {color: '#ef4444'}]}>{absent}</Text>
                <Text style={styles.statLbl}>Absent</Text>
              </View>
              <View style={[styles.statCard, {backgroundColor: '#fffbeb', borderColor: '#fde68a'}]}>
                <ClockIcon size={20} color="#f59e0b" />
                <Text style={[styles.statVal, {color: '#f59e0b'}]}>{late}</Text>
                <Text style={styles.statLbl}>Late</Text>
              </View>
            </View>

            {/* Profile card */}
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
                  <item.icon size={15} color="#7c3aed" />
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
                  <View style={styles.attStatus}>
                    {statusIcon(a.status)}
                    <Text style={[styles.attStatusTxt,
                      a.status === 'P' && {color: '#16a34a'},
                      a.status === 'A' && {color: '#ef4444'},
                      a.status === 'L' && {color: '#f59e0b'},
                    ]}>
                      {a.status === 'P' ? 'Present' : a.status === 'A' ? 'Absent' : 'Late'}
                    </Text>
                  </View>
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
                <Text style={styles.gpaEye}>OVERALL AVERAGE</Text>
                <Text style={styles.gpaVal}>79.8%</Text>
                <Text style={styles.gpaGrade}>Grade B+</Text>
              </View>
              <View style={styles.rankBox}>
                <Text style={styles.rankVal}>4th</Text>
                <Text style={styles.rankLbl}>Class Rank</Text>
              </View>
            </View>

            {GRADES.map((g, i) => {
              const pct = g.score / g.total * 100;
              const col = gradeColor(g.score);
              return (
                <View key={i} style={styles.gradeCard}>
                  <View style={styles.gradeTop}>
                    <Text style={styles.gradeSubject}>{g.subject}</Text>
                    <View style={styles.gradeRight}>
                      <Text style={[styles.gradeScore, {color: col}]}>
                        {g.score}<Text style={styles.gradeOf}>/{g.total}</Text>
                      </Text>
                      <View style={[styles.gradePill, {backgroundColor: col + '20', borderColor: col}]}>
                        <Text style={[styles.gradePillTxt, {color: col}]}>{gradeLabel(g.score)}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.gradeBar}>
                    <View style={[styles.gradeBarFill, {width: `${pct}%`, backgroundColor: col}]} />
                  </View>
                </View>
              );
            })}
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
                  {t.teacher ? (
                    <Text style={styles.ttMeta}>{t.teacher} · {t.room}</Text>
                  ) : null}
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
  heroId: {fontSize: 10, color: '#c4b5fd', marginTop: 1, fontFamily: 'monospace'},
  heroBadge: {
    borderWidth: 1, borderRadius: 10, padding: 8, alignItems: 'center',
  },
  heroBadgeVal: {fontSize: 16, fontWeight: '700'},
  heroBadgeLbl: {fontSize: 9, color: '#6b7280', fontWeight: '500', marginTop: 1},
  tabRow: {
    flexDirection: 'row', backgroundColor: '#ffffff',
    borderBottomWidth: 1, borderBottomColor: '#ede9fe',
  },
  tab: {
    flex: 1, paddingVertical: 11, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabOn: {borderBottomColor: '#7c3aed'},
  tabTxt: {fontSize: 12, fontWeight: '500', color: '#9ca3af'},
  tabTxtOn: {color: '#7c3aed', fontWeight: '700'},
  content: {flex: 1, paddingHorizontal: 14, paddingTop: 14},
  statsRow: {flexDirection: 'row', gap: 8, marginBottom: 14},
  statCard: {
    flex: 1, borderRadius: 12, padding: 12,
    alignItems: 'center', gap: 4, borderWidth: 1,
  },
  statVal: {fontSize: 22, fontWeight: '700'},
  statLbl: {fontSize: 11, color: '#6b7280', fontWeight: '500'},
  card: {
    backgroundColor: '#ffffff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#ede9fe', marginBottom: 14,
  },
  cardTitle: {fontSize: 15, fontWeight: '700', color: '#1e1b4b', marginBottom: 12},
  profileRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  profileLabel: {fontSize: 12, color: '#6b7280', fontWeight: '500', width: 80},
  profileValue: {fontSize: 13, color: '#1e1b4b', fontWeight: '600', flex: 1},
  attSummary: {
    backgroundColor: '#1e1b4b', borderRadius: 16, padding: 20,
    alignItems: 'center', marginBottom: 14,
  },
  attPct: {fontSize: 40, fontWeight: '700', color: '#ffffff'},
  attLabel: {fontSize: 13, color: '#a78bfa', marginTop: 4, marginBottom: 12},
  attBar: {
    width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3, overflow: 'hidden',
  },
  attBarFill: {height: '100%', borderRadius: 3},
  emptyBox: {alignItems: 'center', paddingVertical: 40, gap: 10},
  emptyTxt: {fontSize: 14, color: '#9ca3af', fontWeight: '500'},
  attRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#ffffff', borderRadius: 10, padding: 12,
    marginBottom: 6, borderWidth: 1, borderColor: '#ede9fe',
  },
  attDateBox: {
    backgroundColor: '#f5f3ff', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  attDate: {fontSize: 11, fontWeight: '600', color: '#7c3aed'},
  attClass: {flex: 1, fontSize: 12, color: '#6b7280', fontWeight: '500'},
  attStatus: {flexDirection: 'row', alignItems: 'center', gap: 4},
  attStatusTxt: {fontSize: 12, fontWeight: '600'},
  gpaBanner: {
    backgroundColor: '#1e1b4b', borderRadius: 14, padding: 18,
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  gpaEye: {fontSize: 10, letterSpacing: 2, color: '#a78bfa', fontWeight: '600', marginBottom: 4},
  gpaVal: {fontSize: 32, fontWeight: '700', color: '#ffffff'},
  gpaGrade: {fontSize: 13, color: '#a78bfa', fontWeight: '500', marginTop: 2},
  rankBox: {
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10,
    padding: 14, alignItems: 'center',
  },
  rankVal: {fontSize: 24, fontWeight: '700', color: '#ffffff'},
  rankLbl: {fontSize: 10, color: '#a78bfa', fontWeight: '500', marginTop: 2},
  gradeCard: {
    backgroundColor: '#ffffff', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#ede9fe',
  },
  gradeTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  gradeSubject: {fontSize: 14, fontWeight: '700', color: '#1e1b4b'},
  gradeRight: {alignItems: 'flex-end', gap: 4},
  gradeScore: {fontSize: 18, fontWeight: '700'},
  gradeOf: {fontSize: 12, color: '#9ca3af'},
  gradePill: {
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  gradePillTxt: {fontSize: 10, fontWeight: '700'},
  gradeBar: {
    height: 4, backgroundColor: '#f3f4f6',
    borderRadius: 2, overflow: 'hidden',
  },
  gradeBarFill: {height: '100%', borderRadius: 2},
  ttDay: {fontSize: 14, fontWeight: '600', color: '#6b7280', marginBottom: 10},
  ttCard: {
    flexDirection: 'row', backgroundColor: '#ffffff',
    borderRadius: 10, marginBottom: 6, overflow: 'hidden',
    borderWidth: 1, borderColor: '#ede9fe',
  },
  ttBreak: {opacity: 0.5},
  ttTimeCol: {
    width: 54, padding: 12, alignItems: 'center',
    justifyContent: 'center', borderRightWidth: 1,
    borderRightColor: '#f3f4f6',
  },
  ttTime: {fontSize: 11, fontWeight: '600', color: '#6b7280'},
  ttBody: {flex: 1, padding: 12},
  ttSubject: {fontSize: 14, fontWeight: '700', color: '#1e1b4b'},
  ttMeta: {fontSize: 11, color: '#9ca3af', marginTop: 2},
});
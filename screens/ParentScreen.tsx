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
  BanknotesIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowRightOnRectangleIcon,
  ExclamationCircleIcon,
} from 'react-native-heroicons/outline';

import {SCHOOL_CODE} from '../config';
const TABS = ['Overview', 'Attendance', 'Homework', 'Timetable', 'Fee', 'Results', 'Notifications'];

export default function ParentScreen({navigation}: any) {
  const [tab, setTab] = useState('Overview');
  const [parent, setParent] = useState<any>(null);
  const [student, setStudent] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [feeStatus, setFeeStatus] = useState<any>(null);
  const [feeStructure, setFeeStructure] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<any[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [timetable, setTimetable] = useState<any>(null);
  const [homework, setHomework] = useState<any[]>([]);
  const todayName = new Date().toLocaleDateString('en-US', {weekday: 'long'});
  const [ttDay, setTtDay] = useState(todayName === 'Sunday' ? 'Monday' : todayName);
  const todayKey = new Date().toISOString().split('T')[0];

  const month = new Date().toLocaleString('default', {month: 'long', year: 'numeric'});

  useEffect(() => {loadParentData();}, []);

  useEffect(() => {
    if (tab === 'Results' && student) loadResults();
  }, [tab, student]);

  const loadParentData = async () => {
    try {
      const user = auth().currentUser;
      if (!user) return;
      const id = user.email?.split('@')[0].toUpperCase();

      const parentDoc = await firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('parents').doc(id)
        .get();

      const parentData = parentDoc.data();
      if (parentData) {
        setParent(parentData);

        if (parentData?.studentId) {
          const studentDoc = await firestore()
            .collection('schools').doc(SCHOOL_CODE)
            .collection('students').doc(parentData.studentId)
            .get();

          const studentData = studentDoc.data();
          if (studentData) {
            setStudent(studentData);

            // NAYA TAREEQA: attendanceMap se direct — koi extra read nahi!
            const map = studentData?.attendanceMap || {};
            const records = Object.keys(map).map(date => ({
              date,
              status: map[date],
              class: studentData?.class,
            }));
            setAttendance(records.sort((a, b) => b.date.localeCompare(a.date)));

            const feeDoc = await firestore()
              .collection('schools').doc(SCHOOL_CODE)
              .collection('fees').doc(month)
              .collection('students').doc(studentData?.id)
              .get();
            setFeeStatus(feeDoc.data() || null);

            const feeStructDoc = await firestore()
              .collection('schools').doc(SCHOOL_CODE)
              .collection('feeStructure').doc(studentData?.class)
              .get();
            setFeeStructure(feeStructDoc.data()?.amount || 0);

            // Timetable (1 read — bachay ki class ka)
            try {
              const ttDoc = await firestore()
                .collection('schools').doc(SCHOOL_CODE)
                .collection('timetable').doc(studentData?.class)
                .get();
              const ttData = ttDoc.data(); if (ttData) setTimetable(ttData);
            } catch (e) {console.log('❌ QUANTAIP Error:', e);}

            // Homework (1 read — bachay ki class ka)
            try {
              const hwDoc = await firestore()
                .collection('schools').doc(SCHOOL_CODE)
                .collection('homework').doc(studentData?.class)
                .get();
              setHomework(hwDoc.data()?.items || []);
            } catch (e) {console.log('❌ QUANTAIP Error:', e);}
          }
        }
      }
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  const loadResults = async () => {
    if (!student) return;
    setLoadingResults(true);
    try {
      // NAYA TAREEQA: sirf 1 read — bachay ka doc, resultsMap ke saath
      const doc = await firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('students').doc(student.id)
        .get();
      const map = doc.data()?.resultsMap || {};
      const myResults = Object.values(map);
      setResults(myResults.sort((a: any, b: any) =>
        (b.generatedDate || '').localeCompare(a.generatedDate || '')));
    } catch (e) {
      console.log('❌ QUANTAIP Error:', e);
    } finally {
      setLoadingResults(false);
    }
  };

  const present = attendance.filter(a => a.status === 'P').length;
  const absent = attendance.filter(a => a.status === 'A').length;
  const late = attendance.filter(a => a.status === 'L').length;
  const attendancePct = attendance.length > 0 ? Math.round((present / attendance.length) * 100) : 0;

  const calculateFinalFee = () => {
    if (!student || !feeStructure) return 0;
    switch (student.feeType) {
      case 'full_scholarship': return 0;
      case 'scholarship':
      case 'kinship':
        return Math.round(feeStructure - (feeStructure * (student.feeDiscount || 0) / 100));
      case 'discount':
        return Math.max(0, feeStructure - (student.feeDiscount || 0));
      default:
        return feeStructure;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#C9A84C" />
        <Text style={styles.loadingTxt}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>

      {/* NAVBAR */}
      <View style={styles.navbar}>
        <View>
          <Text style={styles.brand}>QUANT<Text style={styles.brandAccent}>AIP</Text></Text>
          <Text style={styles.navSub}>PARENT PORTAL</Text>
        </View>
        <TouchableOpacity onPress={() => {auth().signOut(); navigation.navigate('Login');}}>
          <ArrowRightOnRectangleIcon size={22} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>

      {/* CHILD CARD */}
      <View style={styles.childCard}>
        <View style={styles.childAv}>
          <Text style={styles.childAvTxt}>
            {(student?.fullName || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
          </Text>
        </View>
        <View style={styles.childInfo}>
          <Text style={styles.childName}>{student?.fullName || 'N/A'}</Text>
          <Text style={styles.childMeta}>{student?.class} — {student?.section}</Text>
          <Text style={styles.childId}>{student?.id}</Text>
        </View>
        <View style={[styles.attBadge,
          {backgroundColor: attendancePct >= 75 ? '#f0fdf4' : '#fef2f2',
           borderColor: attendancePct >= 75 ? '#86efac' : '#fca5a5'}]}>
          <Text style={[styles.attBadgeVal, {color: attendancePct >= 75 ? '#16a34a' : '#ef4444'}]}>
            {attendancePct}%
          </Text>
          <Text style={styles.attBadgeLbl}>Attend.</Text>
        </View>
      </View>

      {/* TABS */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#ece5d3', maxHeight: 44}}>
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
                <ExclamationCircleIcon size={18} color="#ef4444" />
                <Text style={[styles.statVal, {color: '#ef4444'}]}>{absent}</Text>
                <Text style={styles.statLbl}>Absent</Text>
              </View>
              <View style={[styles.statCard, {
                backgroundColor: feeStatus?.status === 'paid' ? '#f0fdf4' : '#fef2f2',
                borderColor: feeStatus?.status === 'paid' ? '#bbf7d0' : '#fecaca',
              }]}>
                <BanknotesIcon size={18} color={feeStatus?.status === 'paid' ? '#16a34a' : '#ef4444'} />
                <Text style={[styles.statVal, {color: feeStatus?.status === 'paid' ? '#16a34a' : '#ef4444'}]}>
                  {feeStatus?.status === 'paid' ? 'Paid' : 'Due'}
                </Text>
                <Text style={styles.statLbl}>Fee</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Child Profile</Text>
              {[
                {label: 'Full Name', value: student?.fullName, icon: UserIcon},
                {label: 'Father', value: student?.fatherName || 'N/A', icon: UserIcon},
                {label: 'Class', value: `${student?.class} — ${student?.section}`, icon: AcademicCapIcon},
                {label: 'Roll No', value: student?.rollNo || 'N/A', icon: ChartBarIcon},
                {label: 'Student ID', value: student?.id, icon: UserIcon},
              ].map((item, i) => (
                <View key={i} style={styles.profileRow}>
                  <item.icon size={14} color="#C9A84C" />
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
                <Text style={styles.attStat}>✅ Present: {present}</Text>
                <Text style={styles.attStat}>❌ Absent: {absent}</Text>
                <Text style={styles.attStat}>⏰ Late: {late}</Text>
              </View>
            </View>
            {attendance.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTxt}>No attendance records yet</Text>
              </View>
            ) : (
              attendance.slice(0, 20).map((a, i) => (
                <View key={i} style={styles.attRow}>
                  <View style={styles.attDateBox}>
                    <Text style={styles.attDate}>{a.date}</Text>
                  </View>
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

        {/* FEE */}
        {tab === 'Homework' && (
          <View>
            <Text style={styles.sectionTitle}>
              Homework — {student?.fullName || student?.name}
            </Text>
            {homework.length === 0 ? (
              <Text style={{fontSize: 13, color: '#9ca3af', textAlign: 'center', marginTop: 20}}>
                No homework assigned yet.
              </Text>
            ) : (
              homework.map((hw: any, i: number) => {
                const isOverdue = hw.dueDate && hw.dueDate < todayKey;
                const isDueToday = hw.dueDate === todayKey;
                return (
                  <View key={i} style={{
                    backgroundColor: '#ffffff', borderRadius: 14, padding: 14,
                    borderWidth: 1, marginBottom: 8,
                    borderColor: isDueToday ? '#f59e0b' : isOverdue ? '#fecaca' : '#ece5d3',
                  }}>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                      <Text style={{fontSize: 11, fontWeight: '700', color: '#d97706'}}>{hw.subject}</Text>
                      <Text style={{
                        fontSize: 11, fontWeight: '600',
                        color: isDueToday ? '#d97706' : isOverdue ? '#ef4444' : '#9ca3af',
                      }}>
                        {isDueToday ? '⏰ Due Today' : isOverdue ? 'Past due: ' + hw.dueDate : 'Due: ' + hw.dueDate}
                      </Text>
                    </View>
                    <Text style={{fontSize: 14, fontWeight: '600', color: '#0d1f3c', marginTop: 4}}>{hw.title}</Text>
                    {hw.description ? (
                      <Text style={{fontSize: 12, color: '#6b7280', marginTop: 2}}>{hw.description}</Text>
                    ) : null}
                    <Text style={{fontSize: 11, color: '#9ca3af', marginTop: 6}}>
                      {hw.teacherName} · Assigned {hw.assignedDate}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        )}

        {tab === 'Timetable' && (
          <View>
            {/* Day selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 12}}>
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => (
                <TouchableOpacity key={i}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8,
                    backgroundColor: ttDay === d ? '#C9A84C' : '#ffffff',
                    borderWidth: 1, borderColor: ttDay === d ? '#C9A84C' : '#ece5d3',
                  }}
                  onPress={() => setTtDay(d)}>
                  <Text style={{
                    fontSize: 12, fontWeight: '600',
                    color: ttDay === d ? '#ffffff' : '#6b7280',
                  }}>{d.slice(0, 3)}{d === 'Friday' ? ' 🕌' : ''}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.sectionTitle}>
              {student?.fullName || student?.name} — {ttDay}{ttDay === todayName ? ' (Today)' : ''}
            </Text>

            {timetable && timetable[ttDay] ? (
              timetable[ttDay].map((t: any, i: number) => (
                <View key={i} style={[
                  styles.card,
                  {marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12},
                  t.period === 0 && {backgroundColor: '#f0fdf4', borderColor: '#bbf7d0'},
                ]}>
                  <View style={{minWidth: 90}}>
                    <Text style={{fontSize: 11, fontWeight: '700', color: '#C9A84C'}}>{t.time}</Text>
                  </View>
                  <View style={{flex: 1}}>
                    <Text style={{
                      fontSize: 14, fontWeight: '600',
                      color: t.period === 0 ? '#16a34a' : '#0d1f3c',
                    }}>{t.period === 0 ? '🍎 Break' : t.subject || '—'}</Text>
                    {t.teacher ? (
                      <Text style={{fontSize: 12, color: '#9ca3af', marginTop: 2}}>{t.teacher}</Text>
                    ) : null}
                  </View>
                </View>
              ))
            ) : (
              <Text style={{fontSize: 13, color: '#9ca3af', textAlign: 'center', marginTop: 20}}>
                Timetable abhi set nahi hua.
              </Text>
            )}
          </View>
        )}

        {tab === 'Fee' && (
          <View>
            <Text style={styles.sectionTitle}>Fee Status — {month}</Text>
            <View style={[styles.feeBanner,
              {backgroundColor: feeStatus?.status === 'paid' ? '#f0fdf4' : '#fef2f2',
               borderColor: feeStatus?.status === 'paid' ? '#86efac' : '#fca5a5'}]}>
              {feeStatus?.status === 'paid'
                ? <CheckCircleIcon size={32} color="#16a34a" />
                : <ClockIcon size={32} color="#ef4444" />}
              <Text style={[styles.feeStatusTxt, {color: feeStatus?.status === 'paid' ? '#16a34a' : '#ef4444'}]}>
                {feeStatus?.status === 'paid' ? 'Fee Paid ✅' : 'Fee Pending ⚠️'}
              </Text>
            </View>
            <View style={styles.card}>
              {[
                {label: 'Standard Fee', value: `PKR ${feeStructure.toLocaleString()}`},
                {label: 'Fee Type', value: student?.feeType === 'full_scholarship' ? 'Full Scholarship' :
                  student?.feeType === 'scholarship' ? `${student?.feeDiscount}% Scholarship` :
                  student?.feeType === 'kinship' ? `${student?.feeDiscount}% Kinship` :
                  student?.feeType === 'discount' ? `PKR ${student?.feeDiscount} Discount` : 'Standard'},
                {label: 'Final Amount', value: `PKR ${calculateFinalFee().toLocaleString()}`, highlight: true},
                {label: 'Status', value: feeStatus?.status === 'paid' ? 'Paid ✅' : 'Pending ⚠️'},
                {label: 'Month', value: month},
              ].map((row, i) => (
                <View key={i} style={styles.feeRow}>
                  <Text style={styles.feeLbl}>{row.label}</Text>
                  <Text style={[styles.feeVal, (row as any).highlight && {color: '#C9A84C', fontSize: 16}]}>
                    {row.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* RESULTS */}
        {tab === 'Results' && (
          <View>
            <View style={[styles.feeBanner, {backgroundColor: '#0d1f3c', borderColor: '#0d1f3c', marginBottom: 16}]}>
              <View style={{flex: 1}}>
                <Text style={{fontSize: 10, letterSpacing: 2, color: '#C9A84C', fontWeight: '600', marginBottom: 4}}>
                  RESULT CARD
                </Text>
                <Text style={{fontSize: 18, fontWeight: '700', color: '#ffffff'}}>{student?.fullName}</Text>
                <Text style={{fontSize: 12, color: '#C9A84C', marginTop: 2}}>
                  {student?.class} — {student?.section}
                </Text>
              </View>
              <View style={{backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 12, alignItems: 'center'}}>
                <Text style={{fontSize: 22, fontWeight: '700', color: '#ffffff'}}>{results.length}</Text>
                <Text style={{fontSize: 10, color: '#C9A84C'}}>Results</Text>
              </View>
            </View>

            {loadingResults ? (
              <ActivityIndicator color="#C9A84C" size="large" style={{marginTop: 20}} />
            ) : results.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTxt}>No results yet</Text>
              </View>
            ) : (
              results.map((r, i) => (
                <View key={i} style={styles.card}>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
                    <View>
                      <Text style={{fontSize: 15, fontWeight: '700', color: '#0d1f3c'}}>
                        {r.testType?.charAt(0).toUpperCase() + r.testType?.slice(1)} Result
                      </Text>
                      <Text style={{fontSize: 11, color: '#9ca3af', marginTop: 2}}>
                        {r.generatedAt?.toDate?.()?.toLocaleDateString?.() || ''}
                      </Text>
                    </View>
                    <View style={{
                      backgroundColor: r.position <= 3 ? '#fffbeb' : '#fdf8ee',
                      borderRadius: 10, padding: 10, alignItems: 'center',
                      borderWidth: 1, borderColor: r.position <= 3 ? '#fcd34d' : '#b8a88a',
                    }}>
                      <Text style={{fontSize: 18, fontWeight: '700', color: r.position <= 3 ? '#f59e0b' : '#C9A84C'}}>
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
                        <Text style={{fontSize: 13, fontWeight: '600', color: '#0d1f3c'}}>
                          {r.subjects[subj].obtained}/{r.subjects[subj].total}
                        </Text>
                        <View style={{
                          backgroundColor: r.subjects[subj].grade === 'A+' ? '#f0fdf4' :
                            r.subjects[subj].grade === 'F' ? '#fef2f2' : '#fdf8ee',
                          borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
                        }}>
                          <Text style={{fontSize: 11, fontWeight: '700',
                            color: r.subjects[subj].grade === 'A+' ? '#16a34a' :
                              r.subjects[subj].grade === 'F' ? '#ef4444' : '#C9A84C',
                          }}>{r.subjects[subj].grade}</Text>
                        </View>
                      </View>
                    </View>
                  ))}

                  <View style={{
                    flexDirection: 'row', justifyContent: 'space-between',
                    alignItems: 'center', marginTop: 10, paddingTop: 10,
                    borderTopWidth: 2, borderTopColor: '#ece5d3',
                  }}>
                    <Text style={{fontSize: 14, fontWeight: '700', color: '#0d1f3c'}}>Total</Text>
                    <View style={{alignItems: 'flex-end'}}>
                      <Text style={{fontSize: 16, fontWeight: '700', color: '#C9A84C'}}>
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

        {/* NOTIFICATIONS */}
        {tab === 'Notifications' && (
          <View>
            <Text style={styles.sectionTitle}>Notifications</Text>
            {absent > 0 && (
              <View style={[styles.notifCard, {backgroundColor: '#fef2f2', borderLeftColor: '#ef4444', borderColor: '#fecaca'}]}>
                <ExclamationCircleIcon size={18} color="#ef4444" />
                <View style={styles.notifBody}>
                  <Text style={styles.notifTitle}>Attendance Alert</Text>
                  <Text style={styles.notifDesc}>
                    {student?.fullName} has been absent {absent} time{absent > 1 ? 's' : ''}.
                  </Text>
                </View>
              </View>
            )}
            {feeStatus?.status !== 'paid' && (
              <View style={[styles.notifCard, {backgroundColor: '#fffbeb', borderLeftColor: '#f59e0b', borderColor: '#fde68a'}]}>
                <BanknotesIcon size={18} color="#f59e0b" />
                <View style={styles.notifBody}>
                  <Text style={styles.notifTitle}>Fee Reminder</Text>
                  <Text style={styles.notifDesc}>
                    Fee of PKR {calculateFinalFee().toLocaleString()} is pending for {month}.
                  </Text>
                </View>
              </View>
            )}
            {feeStatus?.status === 'paid' && absent === 0 && (
              <View style={[styles.notifCard, {backgroundColor: '#f0fdf4', borderLeftColor: '#16a34a', borderColor: '#bbf7d0'}]}>
                <CheckCircleIcon size={18} color="#16a34a" />
                <View style={styles.notifBody}>
                  <Text style={styles.notifTitle}>All Good! ✅</Text>
                  <Text style={styles.notifDesc}>No pending issues for {student?.fullName}.</Text>
                </View>
              </View>
            )}
          </View>
        )}

        <View style={{height: 30}} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#faf8f2'},
  loadingWrap: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12},
  loadingTxt: {fontSize: 14, color: '#C9A84C', fontWeight: '500'},
  navbar: {
    backgroundColor: '#0d1f3c', paddingTop: 50, paddingBottom: 16,
    paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {fontSize: 20, fontWeight: '700', color: '#ffffff', letterSpacing: 2},
  brandAccent: {color: '#C9A84C'},
  navSub: {fontSize: 9, letterSpacing: 3, color: 'rgba(255,255,255,0.5)'},
  childCard: {
    backgroundColor: '#ffffff', flexDirection: 'row', alignItems: 'center',
    padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: '#ece5d3',
  },
  childAv: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#fdf8ee', borderWidth: 2, borderColor: '#C9A84C',
    alignItems: 'center', justifyContent: 'center',
  },
  childAvTxt: {fontSize: 14, fontWeight: '700', color: '#C9A84C'},
  childInfo: {flex: 1},
  childName: {fontSize: 15, fontWeight: '700', color: '#0d1f3c'},
  childMeta: {fontSize: 11, color: '#6b7280', marginTop: 2},
  childId: {fontSize: 10, color: '#b8a88a', marginTop: 1},
  attBadge: {borderWidth: 1, borderRadius: 10, padding: 8, alignItems: 'center'},
  attBadgeVal: {fontSize: 16, fontWeight: '700'},
  attBadgeLbl: {fontSize: 9, color: '#6b7280', fontWeight: '500', marginTop: 1},
  tab: {paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: 'transparent'},
  tabOn: {borderBottomColor: '#C9A84C'},
  tabTxt: {fontSize: 12, fontWeight: '500', color: '#9ca3af'},
  tabTxtOn: {color: '#C9A84C', fontWeight: '700'},
  content: {flex: 1, paddingHorizontal: 14, paddingTop: 14},
  statsRow: {flexDirection: 'row', gap: 8, marginBottom: 14},
  statCard: {flex: 1, borderRadius: 12, padding: 12, alignItems: 'center', gap: 4, borderWidth: 1},
  statVal: {fontSize: 18, fontWeight: '700'},
  statLbl: {fontSize: 11, color: '#6b7280', fontWeight: '500'},
  card: {backgroundColor: '#ffffff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#ece5d3', marginBottom: 14},
  cardTitle: {fontSize: 15, fontWeight: '700', color: '#0d1f3c', marginBottom: 12},
  profileRow: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#f3f4f6'},
  profileLabel: {fontSize: 12, color: '#6b7280', fontWeight: '500', width: 80},
  profileValue: {fontSize: 13, color: '#0d1f3c', fontWeight: '600', flex: 1},
  attSummary: {backgroundColor: '#0d1f3c', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 14},
  attPct: {fontSize: 40, fontWeight: '700', color: '#ffffff'},
  attLabel: {fontSize: 13, color: '#C9A84C', marginTop: 4, marginBottom: 12},
  attBar: {width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden'},
  attBarFill: {height: '100%', borderRadius: 3},
  attStats: {flexDirection: 'row', gap: 16, marginTop: 12},
  attStat: {fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '500'},
  emptyBox: {alignItems: 'center', paddingVertical: 40},
  emptyTxt: {fontSize: 14, color: '#9ca3af', fontWeight: '500'},
  attRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#ffffff', borderRadius: 10, padding: 12,
    marginBottom: 6, borderWidth: 1, borderColor: '#ece5d3',
  },
  attDateBox: {backgroundColor: '#fdf8ee', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4},
  attDate: {fontSize: 11, fontWeight: '600', color: '#C9A84C'},
  attStatusTxt: {fontSize: 13, fontWeight: '600'},
  sectionTitle: {fontSize: 17, fontWeight: '700', color: '#0d1f3c', marginBottom: 12},
  feeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1,
  },
  feeStatusTxt: {fontSize: 18, fontWeight: '700'},
  feeRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  feeLbl: {fontSize: 13, color: '#6b7280', fontWeight: '500'},
  feeVal: {fontSize: 13, color: '#0d1f3c', fontWeight: '700'},
  notifCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderWidth: 1, borderLeftWidth: 3, borderRadius: 12,
    padding: 14, marginBottom: 10,
  },
  notifBody: {flex: 1},
  notifTitle: {fontSize: 14, fontWeight: '700', color: '#0d1f3c', marginBottom: 3},
  notifDesc: {fontSize: 12, color: '#6b7280', lineHeight: 18},
});
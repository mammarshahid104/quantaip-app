import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';

const GRADES = [
  {subject: 'Mathematics', teacher: 'Mr. Qaiser', score: 88, total: 100},
  {subject: 'English', teacher: 'Ms. Fatima', score: 91, total: 100},
  {subject: 'Physics', teacher: 'Mr. Arif', score: 76, total: 100},
  {subject: 'Urdu', teacher: 'Ms. Nadia', score: 84, total: 100},
  {subject: 'Pak Studies', teacher: 'Mr. Bilal', score: 61, total: 100},
  {subject: 'Biology', teacher: 'Ms. Sana', score: 79, total: 100},
];

const TIMETABLE = [
  {time: '08:00', subject: 'Mathematics', teacher: 'Mr. Qaiser', room: 'Rm 12', color: '#f5f3ff', border: '#7c3aed'},
  {time: '08:45', subject: 'English', teacher: 'Ms. Fatima', room: 'Rm 4', color: '#f0fdf4', border: '#16a34a'},
  {time: '09:30', subject: 'Physics', teacher: 'Mr. Arif', room: 'Rm 7', color: '#fffbeb', border: '#f59e0b'},
  {time: '10:15', subject: 'Break', teacher: '', room: '', color: '#f9fafb', border: '#e5e7eb'},
  {time: '10:30', subject: 'Urdu', teacher: 'Ms. Nadia', room: 'Rm 2', color: '#eff6ff', border: '#3b82f6'},
  {time: '11:15', subject: 'Biology', teacher: 'Ms. Sana', room: 'Rm 9', color: '#fef2f2', border: '#ef4444'},
  {time: '12:00', subject: 'Lunch', teacher: '', room: '', color: '#f9fafb', border: '#e5e7eb'},
  {time: '12:45', subject: 'Pak Studies', teacher: 'Mr. Bilal', room: 'Rm 5', color: '#f0fdf4', border: '#16a34a'},
];

const CAL = ['','','','p','p','p','p','p','a','p','p','h','l','p','p','p','p','p','p','p','h'];
const TABS = ['Attendance', 'Grades', 'Timetable'];

export default function StudentScreen({navigation}: any) {
  const [tab, setTab] = useState('Attendance');

  const gradeColor = (s: number) =>
    s >= 85 ? '#16a34a' : s >= 70 ? '#7c3aed' : s >= 55 ? '#f59e0b' : '#ef4444';

  const gradeLabel = (s: number) =>
    s >= 90 ? 'A+' : s >= 80 ? 'A' : s >= 70 ? 'B+' : s >= 60 ? 'B' : 'C';

  return (
    <View style={styles.root}>

      {/* NAVBAR */}
      <View style={styles.navbar}>
        <Text style={styles.brand}>
          QUANT<Text style={styles.brandAccent}>AIP</Text>
        </Text>
        <Text style={styles.navSub}>STUDENT PORTAL</Text>
      </View>

      {/* HERO */}
      <View style={styles.hero}>
        <View style={styles.heroAv}>
          <Text style={styles.heroAvTxt}>AK</Text>
        </View>
        <View style={styles.heroInfo}>
          <Text style={styles.heroName}>Ayesha Khan</Text>
          <Text style={styles.heroMeta}>Grade 9-A · Roll 09-001</Text>
        </View>
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeVal}>91%</Text>
          <Text style={styles.heroBadgeLbl}>Attend.</Text>
        </View>
      </View>

      {/* TABS */}
      <View style={styles.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabOn]}
            onPress={() => setTab(t)}>
            <Text style={[styles.tabTxt, tab === t && styles.tabTxtOn]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content}>

        {/* ATTENDANCE */}
        {tab === 'Attendance' && (
          <View>
            <View style={styles.attOverview}>
              <View style={[styles.attCard, {backgroundColor: '#f0fdf4', borderColor: '#bbf7d0'}]}>
                <Text style={[styles.attNum, {color: '#16a34a'}]}>19</Text>
                <Text style={styles.attLbl}>Present</Text>
              </View>
              <View style={[styles.attCard, {backgroundColor: '#fef2f2', borderColor: '#fecaca'}]}>
                <Text style={[styles.attNum, {color: '#ef4444'}]}>1</Text>
                <Text style={styles.attLbl}>Absent</Text>
              </View>
              <View style={[styles.attCard, {backgroundColor: '#fffbeb', borderColor: '#fde68a'}]}>
                <Text style={[styles.attNum, {color: '#f59e0b'}]}>1</Text>
                <Text style={styles.attLbl}>Late</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>May 2026</Text>
              <View style={styles.calHeader}>
                {['M','T','W','T','F','S','S'].map((d,i) => (
                  <Text key={i} style={styles.calHd}>{d}</Text>
                ))}
              </View>
              <View style={styles.calGrid}>
                {CAL.map((v, i) => (
                  <View key={i} style={[
                    styles.calDay,
                    v==='p' && styles.calP,
                    v==='a' && styles.calA,
                    v==='l' && styles.calL,
                    v==='h' && styles.calH,
                    !v && styles.calEmpty,
                  ]}>
                    <Text style={[
                      styles.calDayTxt,
                      v==='p' && {color:'#16a34a'},
                      v==='a' && {color:'#ef4444'},
                      v==='l' && {color:'#f59e0b'},
                    ]}>
                      {v ? i+1 : ''}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
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
                    <View>
                      <Text style={styles.gradeSubject}>{g.subject}</Text>
                      <Text style={styles.gradeTeacher}>{g.teacher}</Text>
                    </View>
                    <View style={styles.gradeRight}>
                      <Text style={[styles.gradeScore, {color: col}]}>
                        {g.score}<Text style={styles.gradeOf}>/{g.total}</Text>
                      </Text>
                      <View style={[styles.gradePill, {backgroundColor: col+'20', borderColor: col}]}>
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
            <Text style={styles.ttDay}>Wednesday, May 20</Text>
            {TIMETABLE.map((t, i) => (
              <View key={i} style={[
                styles.ttCard,
                {backgroundColor: t.color, borderLeftColor: t.border},
                (t.subject === 'Break' || t.subject === 'Lunch') && styles.ttBreak,
              ]}>
                <View style={styles.ttTimeCol}>
                  <Text style={styles.ttTime}>{t.time}</Text>
                </View>
                <View style={styles.ttBody}>
                  <Text style={[
                    styles.ttSubject,
                    (t.subject === 'Break' || t.subject === 'Lunch') && {color: '#9ca3af'},
                  ]}>{t.subject}</Text>
                  {t.teacher ? (
                    <Text style={styles.ttMeta}>{t.teacher} · {t.room}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{height: 20}} />
      </ScrollView>

      {/* LOGOUT */}
      <View style={styles.bottomBar}>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.logoutTxt}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#faf5ff'},
  navbar: {
    backgroundColor: '#1e1b4b',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {fontSize: 20, fontWeight: '700', color: '#ffffff', letterSpacing: 2},
  brandAccent: {color: '#a78bfa'},
  navSub: {fontSize: 9, letterSpacing: 3, color: 'rgba(255,255,255,0.5)'},
  hero: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ede9fe',
  },
  heroAv: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#f5f3ff',
    borderWidth: 2,
    borderColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvTxt: {fontSize: 14, fontWeight: '700', color: '#7c3aed'},
  heroInfo: {flex: 1},
  heroName: {fontSize: 16, fontWeight: '700', color: '#1e1b4b'},
  heroMeta: {fontSize: 12, color: '#6b7280', marginTop: 2},
  heroBadge: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  heroBadgeVal: {fontSize: 18, fontWeight: '700', color: '#16a34a'},
  heroBadgeLbl: {fontSize: 10, color: '#16a34a', fontWeight: '500', marginTop: 1},
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#ede9fe',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabOn: {borderBottomColor: '#7c3aed'},
  tabTxt: {fontSize: 13, fontWeight: '500', color: '#9ca3af'},
  tabTxtOn: {color: '#7c3aed', fontWeight: '700'},
  content: {flex: 1, paddingHorizontal: 14, paddingTop: 14},
  attOverview: {flexDirection: 'row', gap: 8, marginBottom: 14},
  attCard: {
    flex: 1,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  attNum: {fontSize: 24, fontWeight: '700'},
  attLbl: {fontSize: 11, color: '#6b7280', fontWeight: '500', marginTop: 2},
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ede9fe',
    marginBottom: 14,
  },
  cardTitle: {fontSize: 15, fontWeight: '700', color: '#1e1b4b', marginBottom: 10},
  calHeader: {flexDirection: 'row', marginBottom: 4},
  calHd: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
    paddingVertical: 3,
  },
  calGrid: {flexDirection: 'row', flexWrap: 'wrap'},
  calDay: {
    width: '14.28%',
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    marginVertical: 1,
  },
  calP: {backgroundColor: '#f0fdf4'},
  calA: {backgroundColor: '#fef2f2'},
  calL: {backgroundColor: '#fffbeb'},
  calH: {backgroundColor: '#f3f4f6'},
  calEmpty: {backgroundColor: 'transparent'},
  calDayTxt: {fontSize: 12, fontWeight: '500', color: '#9ca3af'},
  gpaBanner: {
    backgroundColor: '#1e1b4b',
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  gpaEye: {fontSize: 10, letterSpacing: 2, color: '#a78bfa', fontWeight: '600', marginBottom: 4},
  gpaVal: {fontSize: 32, fontWeight: '700', color: '#ffffff'},
  gpaGrade: {fontSize: 13, color: '#a78bfa', fontWeight: '500', marginTop: 2},
  rankBox: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  rankVal: {fontSize: 24, fontWeight: '700', color: '#ffffff'},
  rankLbl: {fontSize: 10, color: '#a78bfa', fontWeight: '500', marginTop: 2},
  gradeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ede9fe',
  },
  gradeTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  gradeSubject: {fontSize: 14, fontWeight: '700', color: '#1e1b4b'},
  gradeTeacher: {fontSize: 11, color: '#9ca3af', marginTop: 2},
  gradeRight: {alignItems: 'flex-end', gap: 4},
  gradeScore: {fontSize: 18, fontWeight: '700'},
  gradeOf: {fontSize: 12, color: '#9ca3af'},
  gradePill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  gradePillTxt: {fontSize: 10, fontWeight: '700'},
  gradeBar: {
    height: 4,
    backgroundColor: '#f3f4f6',
    borderRadius: 2,
    overflow: 'hidden',
  },
  gradeBarFill: {height: '100%', borderRadius: 2},
  ttDay: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 10,
  },
  ttCard: {
    flexDirection: 'row',
    borderLeftWidth: 3,
    borderRadius: 10,
    marginBottom: 6,
    overflow: 'hidden',
  },
  ttBreak: {opacity: 0.5},
  ttTimeCol: {
    width: 54,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: 'rgba(0,0,0,0.05)',
  },
  ttTime: {fontSize: 11, fontWeight: '600', color: '#6b7280'},
  ttBody: {flex: 1, padding: 12},
  ttSubject: {fontSize: 14, fontWeight: '700', color: '#1e1b4b'},
  ttMeta: {fontSize: 11, color: '#9ca3af', marginTop: 2},
  bottomBar: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#ede9fe',
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutTxt: {fontSize: 14, fontWeight: '600', color: '#7c3aed'},
});
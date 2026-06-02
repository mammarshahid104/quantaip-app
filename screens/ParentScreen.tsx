import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';

const NOTIFICATIONS = [
  {title: 'Absent today', desc: 'Ayesha was marked absent in Mathematics', time: '9:15 AM', color: '#ef4444', bg: '#fef2f2', border: '#fecaca'},
  {title: 'Fee reminder', desc: 'Monthly fee PKR 4,500 due by May 25', time: 'Yesterday', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a'},
  {title: 'Result available', desc: 'Term 1 report card is now ready', time: '2 days ago', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe'},
  {title: 'Exam tomorrow', desc: 'Physics exam scheduled for tomorrow', time: '2 days ago', color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe'},
];

const SUBJECTS = [
  {name: 'Mathematics', score: 88, color: '#7c3aed'},
  {name: 'English', score: 91, color: '#16a34a'},
  {name: 'Physics', score: 76, color: '#f59e0b'},
  {name: 'Urdu', score: 84, color: '#3b82f6'},
  {name: 'Pak Studies', score: 61, color: '#ef4444'},
  {name: 'Biology', score: 79, color: '#0891b2'},
];

export default function ParentScreen({navigation}: any) {
  return (
    <View style={styles.root}>

      {/* NAVBAR */}
      <View style={styles.navbar}>
        <Text style={styles.brand}>
          QUANT<Text style={styles.brandAccent}>AIP</Text>
        </Text>
        <Text style={styles.navSub}>PARENT PORTAL</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* CHILD CARD */}
        <View style={styles.childCard}>
          <Text style={styles.childEye}>MY CHILD</Text>
          <View style={styles.childRow}>
            <View style={styles.childAv}>
              <Text style={styles.childAvTxt}>AK</Text>
            </View>
            <View style={styles.childInfo}>
              <Text style={styles.childName}>Ayesha Khan</Text>
              <Text style={styles.childMeta}>Grade 9-A · Roll 09-001</Text>
              <Text style={styles.childMeta}>Class Teacher: Mr. Qaiser</Text>
            </View>
          </View>

          {/* QUICK STATS */}
          <View style={styles.quickStats}>
            <View style={styles.qstat}>
              <Text style={[styles.qstatVal, {color: '#a78bfa'}]}>91%</Text>
              <Text style={styles.qstatLbl}>Attendance</Text>
            </View>
            <View style={styles.qstatDivider} />
            <View style={styles.qstat}>
              <Text style={[styles.qstatVal, {color: '#a78bfa'}]}>B+</Text>
              <Text style={styles.qstatLbl}>Avg Grade</Text>
            </View>
            <View style={styles.qstatDivider} />
            <View style={styles.qstat}>
              <Text style={[styles.qstatVal, {color: '#fbbf24'}]}>Due</Text>
              <Text style={styles.qstatLbl}>Fee Status</Text>
            </View>
          </View>
        </View>

        {/* NOTIFICATIONS */}
        <Text style={styles.sectionTitle}>Notifications</Text>
        {NOTIFICATIONS.map((n, i) => (
          <View key={i} style={[styles.notifCard, {backgroundColor: n.bg, borderColor: n.border, borderLeftColor: n.color}]}>
            <View style={[styles.notifDot, {backgroundColor: n.color}]} />
            <View style={styles.notifBody}>
              <Text style={styles.notifTitle}>{n.title}</Text>
              <Text style={styles.notifDesc}>{n.desc}</Text>
              <Text style={styles.notifTime}>{n.time}</Text>
            </View>
          </View>
        ))}

        {/* GRADES */}
        <Text style={styles.sectionTitle}>Academic Performance</Text>
        <View style={styles.card}>
          {SUBJECTS.map((s, i) => (
            <View key={i} style={styles.subjectRow}>
              <Text style={styles.subjectName}>{s.name}</Text>
              <View style={styles.subjectBarWrap}>
                <View style={[styles.subjectBar, {width: `${s.score}%`, backgroundColor: s.color}]} />
              </View>
              <Text style={[styles.subjectScore, {color: s.color}]}>{s.score}%</Text>
            </View>
          ))}
        </View>

        {/* FEE */}
        <Text style={styles.sectionTitle}>Fee Status</Text>
        <View style={styles.feeCard}>
          <View style={styles.feeRow}>
            <Text style={styles.feeLbl}>Monthly Fee</Text>
            <Text style={styles.feeVal}>PKR 4,500</Text>
          </View>
          <View style={styles.feeDivider} />
          <View style={styles.feeRow}>
            <Text style={styles.feeLbl}>Due Date</Text>
            <Text style={[styles.feeVal, {color: '#f59e0b'}]}>May 25, 2026</Text>
          </View>
          <View style={styles.feeDivider} />
          <View style={styles.feeRow}>
            <Text style={styles.feeLbl}>Status</Text>
            <View style={styles.feePill}>
              <Text style={styles.feePillTxt}>UNPAID</Text>
            </View>
          </View>
        </View>

        {/* LOGOUT */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => navigation.navigate('Login')}>
          <Text style={styles.logoutTxt}>Logout</Text>
        </TouchableOpacity>

      </ScrollView>
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
  scroll: {padding: 16, paddingBottom: 40},
  childCard: {
    backgroundColor: '#1e1b4b',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
  },
  childEye: {
    fontSize: 10,
    letterSpacing: 4,
    color: '#a78bfa',
    fontWeight: '600',
    marginBottom: 12,
  },
  childRow: {flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16},
  childAv: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(167,139,250,0.2)',
    borderWidth: 2,
    borderColor: '#a78bfa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  childAvTxt: {fontSize: 16, fontWeight: '700', color: '#a78bfa'},
  childInfo: {flex: 1},
  childName: {fontSize: 18, fontWeight: '700', color: '#ffffff'},
  childMeta: {fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 3},
  quickStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 14,
  },
  qstat: {flex: 1, alignItems: 'center'},
  qstatVal: {fontSize: 20, fontWeight: '700'},
  qstatLbl: {fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 3, fontWeight: '500'},
  qstatDivider: {width: 1, backgroundColor: 'rgba(255,255,255,0.15)'},
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e1b4b',
    marginBottom: 10,
    marginTop: 4,
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderRadius: 12,
    padding: 13,
    marginBottom: 8,
  },
  notifDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
    flexShrink: 0,
  },
  notifBody: {flex: 1},
  notifTitle: {fontSize: 14, fontWeight: '700', color: '#1e1b4b', marginBottom: 2},
  notifDesc: {fontSize: 12, color: '#6b7280', lineHeight: 18},
  notifTime: {fontSize: 11, color: '#9ca3af', marginTop: 4, fontWeight: '500'},
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ede9fe',
    marginBottom: 20,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  subjectName: {fontSize: 13, fontWeight: '500', color: '#374151', width: 90},
  subjectBarWrap: {
    flex: 1,
    height: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  subjectBar: {height: '100%', borderRadius: 3},
  subjectScore: {fontSize: 13, fontWeight: '700', width: 38, textAlign: 'right'},
  feeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ede9fe',
    overflow: 'hidden',
    marginBottom: 20,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  feeDivider: {height: 1, backgroundColor: '#f3f4f6'},
  feeLbl: {fontSize: 13, color: '#6b7280', fontWeight: '500'},
  feeVal: {fontSize: 14, fontWeight: '700', color: '#1e1b4b'},
  feePill: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  feePillTxt: {fontSize: 11, fontWeight: '700', color: '#ef4444'},
  logoutBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ede9fe',
  },
  logoutTxt: {fontSize: 15, fontWeight: '700', color: '#7c3aed'},
});
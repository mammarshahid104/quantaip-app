import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';

const STUDENTS = [
  {id: 1, name: 'Ayesha Khan', roll: '09-001'},
  {id: 2, name: 'Zain Ahmed', roll: '09-002'},
  {id: 3, name: 'Sara Rauf', roll: '09-003'},
  {id: 4, name: 'Hamza Malik', roll: '09-004'},
  {id: 5, name: 'Rabia Noor', roll: '09-005'},
  {id: 6, name: 'Omar Mirza', roll: '09-006'},
  {id: 7, name: 'Fatima Butt', roll: '09-007'},
  {id: 8, name: 'Ali Hassan', roll: '09-008'},
];

export default function TeacherScreen({navigation}: any) {
  const [attendance, setAttendance] = useState<{[key: number]: string}>({});
  const [submitted, setSubmitted] = useState(false);

  const mark = (id: number, status: string) => {
    setAttendance(prev => ({...prev, [id]: status}));
  };

  const present = Object.values(attendance).filter(v => v === 'P').length;
  const absent = Object.values(attendance).filter(v => v === 'A').length;
  const late = Object.values(attendance).filter(v => v === 'L').length;
  const allMarked = Object.keys(attendance).length === STUDENTS.length;

  if (submitted) {
    return (
      <View style={styles.root}>
        <View style={styles.navbar}>
          <Text style={styles.brand}>QUANT<Text style={styles.brandAccent}>AIP</Text></Text>
          <Text style={styles.navSub}>TEACHER PANEL</Text>
        </View>
        <View style={styles.successWrap}>
          <Text style={styles.successIcon}>✅</Text>
          <Text style={styles.successTitle}>Submitted!</Text>
          <Text style={styles.successSub}>
            Attendance saved.{'\n'}Parents of absent students notified.
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
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.navigate('Login')}>
            <Text style={styles.backBtnTxt}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* NAVBAR */}
      <View style={styles.navbar}>
        <Text style={styles.brand}>
          QUANT<Text style={styles.brandAccent}>AIP</Text>
        </Text>
        <Text style={styles.navSub}>TEACHER PANEL</Text>
      </View>

      {/* CLASS INFO */}
      <View style={styles.classInfo}>
        <Text style={styles.classEye}>ATTENDANCE</Text>
        <Text style={styles.className}>
          Grade 9-A — <Text style={styles.classAccent}>Mathematics</Text>
        </Text>
        <Text style={styles.classMeta}>Mr. Qaiser · Room 12 · 08:00–08:45</Text>
      </View>

      {/* SUMMARY */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, {backgroundColor: '#f0fdf4', borderColor: '#bbf7d0'}]}>
          <Text style={[styles.summaryNum, {color: '#16a34a'}]}>{present}</Text>
          <Text style={styles.summaryLbl}>Present</Text>
        </View>
        <View style={[styles.summaryCard, {backgroundColor: '#fef2f2', borderColor: '#fecaca'}]}>
          <Text style={[styles.summaryNum, {color: '#ef4444'}]}>{absent}</Text>
          <Text style={styles.summaryLbl}>Absent</Text>
        </View>
        <View style={[styles.summaryCard, {backgroundColor: '#fffbeb', borderColor: '#fde68a'}]}>
          <Text style={[styles.summaryNum, {color: '#f59e0b'}]}>{late}</Text>
          <Text style={styles.summaryLbl}>Late</Text>
        </View>
      </View>

      {/* STUDENT LIST */}
      <ScrollView style={styles.list}>
        {STUDENTS.map(s => {
          const status = attendance[s.id];
          return (
            <View key={s.id} style={styles.studentRow}>
              <View style={[styles.avatar, status === 'P' && styles.avatarP, status === 'A' && styles.avatarA, status === 'L' && styles.avatarL]}>
                <Text style={[styles.avatarTxt, status && {color: status === 'P' ? '#16a34a' : status === 'A' ? '#ef4444' : '#f59e0b'}]}>
                  {s.name.split(' ').map(n => n[0]).join('')}
                </Text>
              </View>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{s.name}</Text>
                <Text style={styles.studentRoll}>{s.roll}</Text>
              </View>
              <View style={styles.btnGroup}>
                <TouchableOpacity
                  style={[styles.attBtn, status === 'P' && styles.btnP]}
                  onPress={() => mark(s.id, 'P')}>
                  <Text style={[styles.attBtnTxt, status === 'P' && {color: '#16a34a'}]}>P</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.attBtn, status === 'A' && styles.btnA]}
                  onPress={() => mark(s.id, 'A')}>
                  <Text style={[styles.attBtnTxt, status === 'A' && {color: '#ef4444'}]}>A</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.attBtn, status === 'L' && styles.btnL]}
                  onPress={() => mark(s.id, 'L')}>
                  <Text style={[styles.attBtnTxt, status === 'L' && {color: '#f59e0b'}]}>L</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
        <View style={{height: 100}} />
      </ScrollView>

      {/* SUBMIT */}
      <View style={styles.submitBar}>
        <TouchableOpacity
          style={[styles.submitBtn, !allMarked && styles.submitBtnOff]}
          disabled={!allMarked}
          onPress={() => setSubmitted(true)}>
          <Text style={styles.submitTxt}>
            {allMarked
              ? 'Submit Attendance'
              : `Mark all students (${Object.keys(attendance).length}/${STUDENTS.length})`}
          </Text>
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
  classInfo: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ede9fe',
  },
  classEye: {fontSize: 10, letterSpacing: 4, color: '#7c3aed', fontWeight: '600', marginBottom: 4},
  className: {fontSize: 18, fontWeight: '700', color: '#1e1b4b', marginBottom: 2},
  classAccent: {color: '#7c3aed'},
  classMeta: {fontSize: 12, color: '#6b7280'},
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#ede9fe',
  },
  summaryCard: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
  },
  summaryNum: {fontSize: 22, fontWeight: '700'},
  summaryLbl: {fontSize: 11, color: '#6b7280', fontWeight: '500', marginTop: 2},
  list: {flex: 1, paddingHorizontal: 14},
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f5f3ff',
    borderWidth: 1.5,
    borderColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarP: {backgroundColor: '#f0fdf4', borderColor: '#86efac'},
  avatarA: {backgroundColor: '#fef2f2', borderColor: '#fca5a5'},
  avatarL: {backgroundColor: '#fffbeb', borderColor: '#fcd34d'},
  avatarTxt: {fontSize: 12, fontWeight: '700', color: '#7c3aed'},
  studentInfo: {flex: 1},
  studentName: {fontSize: 14, fontWeight: '600', color: '#1e1b4b'},
  studentRoll: {fontSize: 11, color: '#9ca3af', marginTop: 1},
  btnGroup: {flexDirection: 'row', gap: 6},
  attBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnP: {backgroundColor: '#f0fdf4', borderColor: '#16a34a'},
  btnA: {backgroundColor: '#fef2f2', borderColor: '#ef4444'},
  btnL: {backgroundColor: '#fffbeb', borderColor: '#f59e0b'},
  attBtnTxt: {fontSize: 12, fontWeight: '700', color: '#9ca3af'},
  submitBar: {
    padding: 14,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#ede9fe',
  },
  submitBtn: {
    backgroundColor: '#1e1b4b',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  submitBtnOff: {backgroundColor: '#c4b5fd'},
  submitTxt: {color: '#ffffff', fontSize: 15, fontWeight: '700'},
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  successIcon: {fontSize: 60, marginBottom: 16},
  successTitle: {fontSize: 28, fontWeight: '700', color: '#1e1b4b', marginBottom: 8},
  successSub: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  successStats: {
    flexDirection: 'row',
    gap: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#ede9fe',
  },
  sstat: {alignItems: 'center'},
  sstatVal: {fontSize: 28, fontWeight: '700'},
  sstatLbl: {fontSize: 12, color: '#6b7280', fontWeight: '500', marginTop: 2},
  backBtn: {
    backgroundColor: '#1e1b4b',
    borderRadius: 12,
    padding: 15,
    width: '100%',
    alignItems: 'center',
  },
  backBtnTxt: {color: '#ffffff', fontSize: 15, fontWeight: '700'},
});
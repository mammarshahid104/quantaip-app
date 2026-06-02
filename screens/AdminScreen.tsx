import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';

const STATS = [
  {val: '342', lbl: 'Students', color: '#7c3aed', bg: '#f5f3ff'},
  {val: '24', lbl: 'Teachers', color: '#0891b2', bg: '#ecfeff'},
  {val: '91%', lbl: 'Attendance', color: '#16a34a', bg: '#f0fdf4'},
  {val: '2.1M', lbl: 'PKR Fees', color: '#ea580c', bg: '#fff7ed'},
];

const ALERTS = [
  {msg: '3 students absent today', color: '#ef4444', bg: '#fef2f2'},
  {msg: 'Fee due: 12 students pending', color: '#f59e0b', bg: '#fffbeb'},
  {msg: 'Grade 9-A attendance submitted', color: '#16a34a', bg: '#f0fdf4'},
];

export default function AdminScreen({navigation}: any) {
  return (
    <View style={styles.root}>

      {/* NAVBAR */}
      <View style={styles.navbar}>
        <Text style={styles.brand}>
          QUANT<Text style={styles.brandAccent}>AIP</Text>
        </Text>
        <Text style={styles.navSub}>ADMIN PANEL</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* WELCOME */}
        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeEye}>DASHBOARD</Text>
          <Text style={styles.welcomeTitle}>
            Good morning, <Text style={styles.welcomeAccent}>Admin</Text>
          </Text>
          <Text style={styles.welcomeSub}>Govt. High School · Lahore</Text>
        </View>

        {/* STATS */}
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.statsGrid}>
          {STATS.map((s, i) => (
            <View key={i} style={[styles.statCard, {backgroundColor: s.bg, borderColor: s.color+'33'}]}>
              <Text style={[styles.statVal, {color: s.color}]}>{s.val}</Text>
              <Text style={styles.statLbl}>{s.lbl}</Text>
            </View>
          ))}
        </View>

        {/* ALERTS */}
        <Text style={styles.sectionTitle}>Live Alerts</Text>
        {ALERTS.map((a, i) => (
          <View key={i} style={[styles.alertCard, {backgroundColor: a.bg, borderLeftColor: a.color}]}>
            <View style={[styles.alertDot, {backgroundColor: a.color}]} />
            <Text style={styles.alertTxt}>{a.msg}</Text>
          </View>
        ))}

        {/* QUICK ACTIONS */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity style={styles.actionBtn}>
            <Text style={styles.actionIcon}>👨‍🎓</Text>
            <Text style={styles.actionLbl}>Add Student</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Text style={styles.actionIcon}>👨‍🏫</Text>
            <Text style={styles.actionLbl}>Add Teacher</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Text style={styles.actionIcon}>📊</Text>
            <Text style={styles.actionLbl}>Reports</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Text style={styles.actionIcon}>💰</Text>
            <Text style={styles.actionLbl}>Fee Status</Text>
          </TouchableOpacity>
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
  welcomeCard: {
    backgroundColor: '#1e1b4b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  welcomeEye: {fontSize: 10, letterSpacing: 4, color: '#a78bfa', fontWeight: '600', marginBottom: 6},
  welcomeTitle: {fontSize: 22, fontWeight: '700', color: '#ffffff', marginBottom: 4},
  welcomeAccent: {color: '#a78bfa'},
  welcomeSub: {fontSize: 13, color: 'rgba(255,255,255,0.6)'},
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e1b4b',
    marginBottom: 10,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    width: '47%',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  statVal: {fontSize: 28, fontWeight: '700', marginBottom: 4},
  statLbl: {fontSize: 13, color: '#6b7280', fontWeight: '500'},
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderLeftWidth: 3,
    borderRadius: 10,
    padding: 13,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  alertDot: {width: 8, height: 8, borderRadius: 4, flexShrink: 0},
  alertTxt: {fontSize: 13, color: '#374151', fontWeight: '500', flex: 1},
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  actionBtn: {
    width: '47%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ede9fe',
    gap: 8,
  },
  actionIcon: {fontSize: 28},
  actionLbl: {fontSize: 13, fontWeight: '600', color: '#1e1b4b'},
  logoutBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ede9fe',
  },
  logoutTxt: {fontSize: 14, fontWeight: '600', color: '#7c3aed'},
});
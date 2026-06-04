import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import {
  BanknotesIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  ChartBarIcon,
  AdjustmentsHorizontalIcon,
} from 'react-native-heroicons/outline';

const SCHOOL_CODE = 'GHS-001';

const CLASS_HIERARCHY = [
  {category: 'Early Education', classes: ['Nursery', 'Prep', 'KG']},
  {category: 'Primary', classes: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5']},
  {category: 'Middle', classes: ['Grade 6', 'Grade 7', 'Grade 8']},
  {category: 'Secondary', classes: ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12']},
];

export default function FeeScreen() {
  const [activeTab, setActiveTab] = useState('Students');
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [feeStructure, setFeeStructure] = useState<{[key: string]: string}>({});
  const [selectedClass, setSelectedClass] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  const TABS = ['Students', 'Structure', 'Reports'];
  const month = new Date().toLocaleString('default', {month: 'long', year: 'numeric'});

  // Load all students with fee status
  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const snapshot = await firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('students')
        .get();

      const studentList = await Promise.all(
        snapshot.docs.map(async doc => {
          const student = doc.data();
          // Check fee status for current month
          const feeDoc = await firestore()
            .collection('schools').doc(SCHOOL_CODE)
            .collection('fees').doc(month)
            .collection('students').doc(student.id)
            .get();

          const feeData = feeDoc.exists ? feeDoc.data() : null;

          return {
            ...student,
            feeStatus: feeData?.status || 'pending',
            feePaidOn: feeData?.paidOn || null,
            feeAmount: feeData?.amount || 0,
          };
        })
      );

      setStudents(studentList);
    } catch (e) {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const markPaid = async (student: any) => {
    Alert.alert(
      'Mark as Paid?',
      `Mark ${student.fullName}'s fee as paid for ${month}?`,
      [
        {text: 'Cancel'},
        {
          text: 'Mark Paid',
          onPress: async () => {
            try {
              // Get fee amount from structure
              const feeDoc = await firestore()
                .collection('schools').doc(SCHOOL_CODE)
                .collection('feeStructure').doc(student.class)
                .get();
              const amount = feeDoc.exists ? feeDoc.data()?.amount : 0;

              await firestore()
                .collection('schools').doc(SCHOOL_CODE)
                .collection('fees').doc(month)
                .collection('students').doc(student.id)
                .set({
                  id: student.id,
                  name: student.fullName,
                  class: student.class,
                  section: student.section,
                  amount,
                  status: 'paid',
                  paidOn: firestore.FieldValue.serverTimestamp(),
                });

              // Update local state
              setStudents(prev => prev.map(s =>
                s.id === student.id
                  ? {...s, feeStatus: 'paid', feeAmount: amount}
                  : s
              ));

              Alert.alert('✅ Done!', `${student.fullName}'s fee marked as paid.`);
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  const markUnpaid = async (student: any) => {
    Alert.alert(
      'Mark as Unpaid?',
      `Remove ${student.fullName}'s fee payment for ${month}?`,
      [
        {text: 'Cancel'},
        {
          text: 'Mark Unpaid',
          style: 'destructive',
          onPress: async () => {
            try {
              await firestore()
                .collection('schools').doc(SCHOOL_CODE)
                .collection('fees').doc(month)
                .collection('students').doc(student.id)
                .set({
                  id: student.id,
                  name: student.fullName,
                  class: student.class,
                  section: student.section,
                  status: 'pending',
                });

              setStudents(prev => prev.map(s =>
                s.id === student.id ? {...s, feeStatus: 'pending'} : s
              ));
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  const saveFeeStructure = async (cls: string, amount: string) => {
    if (!amount) return;
    try {
      await firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('feeStructure').doc(cls)
        .set({amount: parseInt(amount), updatedAt: firestore.FieldValue.serverTimestamp()});
      Alert.alert('✅ Saved!', `Fee for ${cls}: PKR ${amount}/month`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  // Filter students
  const filteredStudents = students.filter(s => {
    const classMatch = selectedClass === 'All' || s.class === selectedClass;
    const statusMatch = filterStatus === 'All' || s.feeStatus === filterStatus.toLowerCase();
    return classMatch && statusMatch;
  });

  const paidCount = students.filter(s => s.feeStatus === 'paid').length;
  const pendingCount = students.filter(s => s.feeStatus === 'pending').length;
  const collectionRate = students.length > 0
    ? Math.round((paidCount / students.length) * 100)
    : 0;

  return (
    <View style={styles.root}>

      {/* SUB TABS */}
      <View style={styles.subTabRow}>
        {TABS.map(t => (
          <TouchableOpacity key={t}
            style={[styles.subTab, activeTab === t && styles.subTabOn]}
            onPress={() => setActiveTab(t)}>
            <Text style={[styles.subTabTxt, activeTab === t && styles.subTabTxtOn]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content}>

        {/* ── STUDENTS FEE STATUS ── */}
        {activeTab === 'Students' && (
          <View>
            {/* Summary */}
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, {backgroundColor: '#f0fdf4', borderColor: '#bbf7d0'}]}>
                <CheckCircleIcon size={20} color="#16a34a" />
                <Text style={[styles.summaryVal, {color: '#16a34a'}]}>{paidCount}</Text>
                <Text style={styles.summaryLbl}>Paid</Text>
              </View>
              <View style={[styles.summaryCard, {backgroundColor: '#fef2f2', borderColor: '#fecaca'}]}>
                <ClockIcon size={20} color="#ef4444" />
                <Text style={[styles.summaryVal, {color: '#ef4444'}]}>{pendingCount}</Text>
                <Text style={styles.summaryLbl}>Pending</Text>
              </View>
              <View style={[styles.summaryCard, {backgroundColor: '#f5f3ff', borderColor: '#ddd6fe'}]}>
                <ChartBarIcon size={20} color="#7c3aed" />
                <Text style={[styles.summaryVal, {color: '#7c3aed'}]}>{collectionRate}%</Text>
                <Text style={styles.summaryLbl}>Collected</Text>
              </View>
            </View>

            {/* Filters */}
            <View style={styles.filtersRow}>
              <AdjustmentsHorizontalIcon size={16} color="#6b7280" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {['All', 'Paid', 'Pending'].map(f => (
                  <TouchableOpacity key={f}
                    style={[styles.filterChip, filterStatus === f && styles.filterChipOn]}
                    onPress={() => setFilterStatus(f)}>
                    <Text style={[styles.filterChipTxt, filterStatus === f && styles.filterChipTxtOn]}>{f}</Text>
                  </TouchableOpacity>
                ))}
                <View style={styles.filterDivider} />
                {['All', ...CLASS_HIERARCHY.flatMap(c => c.classes)].map(cls => (
                  <TouchableOpacity key={cls}
                    style={[styles.filterChip, selectedClass === cls && styles.filterChipOn]}
                    onPress={() => setSelectedClass(cls)}>
                    <Text style={[styles.filterChipTxt, selectedClass === cls && styles.filterChipTxtOn]}>{cls}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Student List */}
            {loading ? (
              <ActivityIndicator color="#7c3aed" size="large" style={{marginTop: 30}} />
            ) : filteredStudents.length === 0 ? (
              <View style={styles.emptyBox}>
                <BanknotesIcon size={40} color="#c4b5fd" />
                <Text style={styles.emptyTxt}>
                  {students.length === 0
                    ? 'No students added yet'
                    : 'No students match filter'}
                </Text>
              </View>
            ) : (
              filteredStudents.map((s, i) => (
                <View key={i} style={styles.studentCard}>
                  <View style={styles.studentLeft}>
                    <View style={[styles.studentAv, {
                      backgroundColor: s.feeStatus === 'paid' ? '#f0fdf4' : '#fef2f2',
                      borderColor: s.feeStatus === 'paid' ? '#86efac' : '#fca5a5',
                    }]}>
                      <Text style={[styles.studentAvTxt, {
                        color: s.feeStatus === 'paid' ? '#16a34a' : '#ef4444',
                      }]}>
                        {(s.fullName || s.name || '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                      </Text>
                    </View>
                    <View style={styles.studentInfo}>
                      <Text style={styles.studentName}>{s.fullName || s.name}</Text>
                      <Text style={styles.studentMeta}>{s.class} — {s.section} · {s.id}</Text>
                      {s.feeStatus === 'paid' && (
                        <Text style={styles.paidOn}>
                          Paid {s.feeAmount > 0 ? `· PKR ${s.feeAmount.toLocaleString()}` : ''}
                        </Text>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.statusBtn,
                      s.feeStatus === 'paid' ? styles.statusBtnPaid : styles.statusBtnPending
                    ]}
                    onPress={() => s.feeStatus === 'paid' ? markUnpaid(s) : markPaid(s)}>
                    {s.feeStatus === 'paid'
                      ? <CheckCircleIcon size={14} color="#16a34a" />
                      : <ClockIcon size={14} color="#ef4444" />}
                    <Text style={[styles.statusBtnTxt,
                      {color: s.feeStatus === 'paid' ? '#16a34a' : '#ef4444'}]}>
                      {s.feeStatus === 'paid' ? 'Paid' : 'Pending'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))
            )}

            {/* Refresh */}
            <TouchableOpacity style={styles.refreshBtn} onPress={loadStudents}>
              <Text style={styles.refreshTxt}>Refresh</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── FEE STRUCTURE ── */}
        {activeTab === 'Structure' && (
          <View>
            <Text style={styles.sectionTitle}>Set Monthly Fee</Text>
            {CLASS_HIERARCHY.map((cat, i) => (
              <View key={i} style={styles.card}>
                <Text style={styles.catTitle}>{cat.category}</Text>
                {cat.classes.map((cls, j) => (
                  <View key={j} style={styles.feeRow}>
                    <Text style={styles.className}>{cls}</Text>
                    <View style={styles.feeInputRow}>
                      <Text style={styles.pkrLabel}>PKR</Text>
                      <TextInput
                        style={styles.feeInput}
                        placeholder="0"
                        placeholderTextColor="#c4b5fd"
                        keyboardType="number-pad"
                        value={feeStructure[cls] || ''}
                        onChangeText={val => setFeeStructure(prev => ({...prev, [cls]: val}))}
                      />
                      <TouchableOpacity
                        style={styles.saveBtn}
                        onPress={() => saveFeeStructure(cls, feeStructure[cls] || '')}>
                        <Text style={styles.saveBtnTxt}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* ── REPORTS ── */}
        {activeTab === 'Reports' && (
          <View>
            <Text style={styles.sectionTitle}>Fee Report — {month}</Text>
            <View style={styles.reportCard}>
              <View style={styles.reportRow}>
                <Text style={styles.reportLbl}>Total Students</Text>
                <Text style={styles.reportVal}>{students.length}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.reportRow}>
                <Text style={styles.reportLbl}>Paid</Text>
                <Text style={[styles.reportVal, {color: '#16a34a'}]}>{paidCount}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.reportRow}>
                <Text style={styles.reportLbl}>Pending</Text>
                <Text style={[styles.reportVal, {color: '#ef4444'}]}>{pendingCount}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.reportRow}>
                <Text style={styles.reportLbl}>Collection Rate</Text>
                <Text style={[styles.reportVal, {color: '#7c3aed'}]}>{collectionRate}%</Text>
              </View>
            </View>

            <Text style={[styles.sectionTitle, {marginTop: 16}]}>By Class</Text>
            {CLASS_HIERARCHY.flatMap(c => c.classes).map((cls, i) => {
              const clsStudents = students.filter(s => s.class === cls);
              if (clsStudents.length === 0) return null;
              const clsPaid = clsStudents.filter(s => s.feeStatus === 'paid').length;
              const clsPct = Math.round((clsPaid / clsStudents.length) * 100);
              return (
                <View key={i} style={styles.progressRow}>
                  <Text style={styles.progressCls}>{cls}</Text>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, {width: `${clsPct}%`}]} />
                  </View>
                  <Text style={styles.progressPct}>{clsPct}%</Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={{height: 30}} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#faf5ff'},
  subTabRow: {flexDirection: 'row', backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#ede9fe'},
  subTab: {flex: 1, paddingVertical: 11, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent'},
  subTabOn: {borderBottomColor: '#7c3aed'},
  subTabTxt: {fontSize: 13, fontWeight: '500', color: '#9ca3af'},
  subTabTxtOn: {color: '#7c3aed', fontWeight: '700'},
  content: {paddingHorizontal: 14, paddingTop: 14},
  summaryRow: {flexDirection: 'row', gap: 8, marginBottom: 14},
  summaryCard: {flex: 1, borderRadius: 12, padding: 12, alignItems: 'center', gap: 4, borderWidth: 1},
  summaryVal: {fontSize: 22, fontWeight: '700'},
  summaryLbl: {fontSize: 11, color: '#6b7280', fontWeight: '500'},
  filtersRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12},
  filterChip: {borderWidth: 1, borderColor: '#ede9fe', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#ffffff', marginRight: 6},
  filterChipOn: {borderColor: '#7c3aed', backgroundColor: '#f5f3ff'},
  filterChipTxt: {fontSize: 12, fontWeight: '500', color: '#6b7280'},
  filterChipTxtOn: {color: '#7c3aed', fontWeight: '700'},
  filterDivider: {width: 1, height: 20, backgroundColor: '#e5e7eb', marginHorizontal: 6},
  emptyBox: {alignItems: 'center', paddingVertical: 40, gap: 10},
  emptyTxt: {fontSize: 14, color: '#9ca3af', fontWeight: '500'},
  studentCard: {
    backgroundColor: '#ffffff', borderRadius: 12, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: '#ede9fe',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  studentLeft: {flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1},
  studentAv: {width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center'},
  studentAvTxt: {fontSize: 12, fontWeight: '700'},
  studentInfo: {flex: 1},
  studentName: {fontSize: 14, fontWeight: '600', color: '#1e1b4b'},
  studentMeta: {fontSize: 11, color: '#9ca3af', marginTop: 1},
  paidOn: {fontSize: 11, color: '#16a34a', marginTop: 1, fontWeight: '500'},
  statusBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  statusBtnPaid: {backgroundColor: '#f0fdf4', borderColor: '#86efac'},
  statusBtnPending: {backgroundColor: '#fef2f2', borderColor: '#fca5a5'},
  statusBtnTxt: {fontSize: 11, fontWeight: '700'},
  refreshBtn: {
    backgroundColor: '#ffffff', borderRadius: 10, padding: 12,
    alignItems: 'center', borderWidth: 1, borderColor: '#ede9fe', marginTop: 8,
  },
  refreshTxt: {fontSize: 13, fontWeight: '600', color: '#7c3aed'},
  sectionTitle: {fontSize: 17, fontWeight: '700', color: '#1e1b4b', marginBottom: 10},
  card: {backgroundColor: '#ffffff', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#ede9fe'},
  catTitle: {fontSize: 14, fontWeight: '700', color: '#1e1b4b', marginBottom: 10},
  feeRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6'},
  className: {fontSize: 13, fontWeight: '500', color: '#374151', flex: 1},
  feeInputRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  pkrLabel: {fontSize: 12, color: '#7c3aed', fontWeight: '600'},
  feeInput: {backgroundColor: '#f5f3ff', borderWidth: 1, borderColor: '#ede9fe', borderRadius: 8, padding: 7, fontSize: 13, color: '#1e1b4b', width: 70, textAlign: 'center'},
  saveBtn: {backgroundColor: '#7c3aed', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7},
  saveBtnTxt: {color: '#ffffff', fontSize: 11, fontWeight: '700'},
  reportCard: {backgroundColor: '#ffffff', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#ede9fe', marginBottom: 8},
  reportRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14},
  reportLbl: {fontSize: 13, color: '#6b7280', fontWeight: '500'},
  reportVal: {fontSize: 14, fontWeight: '700', color: '#1e1b4b'},
  divider: {height: 1, backgroundColor: '#f3f4f6'},
  progressRow: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10},
  progressCls: {fontSize: 12, fontWeight: '500', color: '#374151', width: 70},
  progressBar: {flex: 1, height: 6, backgroundColor: '#f3f4f6', borderRadius: 3, overflow: 'hidden'},
  progressFill: {height: '100%', backgroundColor: '#7c3aed', borderRadius: 3},
  progressPct: {fontSize: 12, fontWeight: '700', color: '#7c3aed', width: 35, textAlign: 'right'},
});
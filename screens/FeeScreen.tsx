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
  Modal,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import {
  BanknotesIcon,
  CheckCircleIcon,
  ClockIcon,
  ChartBarIcon,
  AdjustmentsHorizontalIcon,
  XMarkIcon,
  UserIcon,
} from 'react-native-heroicons/outline';

import {getSchoolCode} from '../config';
import {theme} from '../theme';

const CLASS_HIERARCHY = [
  {category: 'Early Education', classes: ['Nursery', 'Prep', 'KG']},
  {category: 'Primary', classes: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5']},
  {category: 'Middle', classes: ['Grade 6', 'Grade 7', 'Grade 8']},
  {category: 'Secondary', classes: ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12']},
];

const FEE_TYPES = [
  {key: 'standard', label: 'Standard'},
  {key: 'scholarship', label: 'Scholarship %'},
  {key: 'discount', label: 'Fixed Discount'},
  {key: 'full_scholarship', label: 'Full Scholarship'},
  {key: 'kinship', label: 'Kinship %'},
];

const calculateFee = (student: any, standardFee: number): number => {
  if (!standardFee) return 0;
  switch (student.feeType) {
    case 'full_scholarship': return 0;
    case 'scholarship':
    case 'kinship':
      return Math.round(standardFee - (standardFee * (student.feeDiscount || 0) / 100));
    case 'discount':
      return Math.max(0, standardFee - (student.feeDiscount || 0));
    default:
      return standardFee;
  }
};

export default function FeeScreen() {
  const [activeTab, setActiveTab] = useState('Students');
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [feeStructure, setFeeStructure] = useState<{[key: string]: number}>({});
  const [feeInputs, setFeeInputs] = useState<{[key: string]: string}>({});
  const [selectedClass, setSelectedClass] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  // Fee type modal
  const [feeModal, setFeeModal] = useState<any>(null);
  const [feeType, setFeeType] = useState('standard');
  const [feeDiscount, setFeeDiscount] = useState('');

  const TABS = ['Students', 'Structure', 'Reports'];
  const month = new Date().toLocaleString('default', {month: 'long', year: 'numeric'});

  useEffect(() => {
    loadStudents();
    loadFeeStructure();
  }, []);

  const loadFeeStructure = async () => {
    try {
      const snap = await firestore()
        .collection('schools').doc(getSchoolCode())
        .collection('feeStructure').get();
      const structure: {[key: string]: number} = {};
      snap.docs.forEach(d => {
        structure[d.id] = d.data().amount || 0;
      });
      setFeeStructure(structure);
    } catch (e) {console.log('❌ QUANTAIP Error:', e);}
  };

  const loadStudents = async () => {
    setLoading(true);
    try {
      // Two queries total instead of N+1: fetch all students AND all of this
      // month's fee docs in parallel, then merge them locally. Previously we
      // fetched each student's fee doc one-by-one, so 100 students meant 101
      // round-trips — the main cause of the slow load.
      const [studentsSnap, feesSnap] = await Promise.all([
        firestore()
          .collection('schools').doc(getSchoolCode())
          .collection('students').get(),
        firestore()
          .collection('schools').doc(getSchoolCode())
          .collection('fees').doc(month)
          .collection('students').get(),
      ]);
      console.log('💰 QUANTAIP FeeScreen students fetched:', studentsSnap.size);

      // Build a studentId → feeData map from the single fees query.
      const feeMap: {[id: string]: any} = {};
      feesSnap.docs.forEach(d => {feeMap[d.id] = d.data();});

      // Merge fee data into each student locally — no per-student reads.
      // Key off the Firestore doc id (always present), falling back to the
      // stored `id` field, matching how fee docs are written.
      const studentList = studentsSnap.docs.map(doc => {
        const student = doc.data();
        const studentId = student.id || doc.id;
        const feeData = feeMap[studentId] || null;
        return {
          ...student,
          id: studentId,
          feeStatus: feeData?.status || 'pending',
          feePaidOn: feeData?.paidOn || null,
          feeAmount: feeData?.amount || 0,
        };
      });
      setStudents(studentList);
    } catch (e) {
      console.log('❌ QUANTAIP FeeScreen loadStudents error:', e);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const saveFeeStructure = async (cls: string, amount: string) => {
    if (!amount) return;
    try {
      const amountNum = parseInt(amount);
      await firestore()
        .collection('schools').doc(getSchoolCode())
        .collection('feeStructure').doc(cls)
        .set({amount: amountNum, updatedAt: firestore.FieldValue.serverTimestamp()});
      setFeeStructure(prev => ({...prev, [cls]: amountNum}));
      Alert.alert('✅ Saved!', `Fee for ${cls}: PKR ${amountNum.toLocaleString()}/month`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const saveFeeType = async () => {
    if (!feeModal) return;
    try {
      const updateData: any = {feeType, feeDiscount: 0};
      if (feeType !== 'standard' && feeType !== 'full_scholarship') {
        updateData.feeDiscount = parseInt(feeDiscount) || 0;
      }

      await firestore()
        .collection('schools').doc(getSchoolCode())
        .collection('students').doc(feeModal.id)
        .update(updateData);

      setStudents(prev => prev.map(s =>
        s.id === feeModal.id ? {...s, ...updateData} : s
      ));

      Alert.alert('✅ Updated!', `Fee type updated for ${feeModal.fullName || feeModal.name}`);
      setFeeModal(null);
      setFeeType('standard');
      setFeeDiscount('');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const markPaid = async (student: any) => {
    // student.id is normalized in loadStudents (student.id || doc.id), so it
    // should always be present here — guard anyway so we never write to
    // .doc(undefined), which would throw.
    const studentId = student.id;
    if (!studentId) {
      Alert.alert('Error', 'This student record has no ID and cannot be updated.');
      return;
    }
    const standardFee = feeStructure[student.class] || 0;
    const finalFee = calculateFee(student, standardFee);

    Alert.alert(
      'Mark as Paid?',
      `${student.fullName || student.name}\nAmount: PKR ${finalFee.toLocaleString()}`,
      [
        {text: 'Cancel'},
        {
          text: 'Mark Paid',
          onPress: async () => {
            // Optimistic UI: flip this one student to "paid" immediately so
            // the screen feels instant. No refetch of the whole list.
            setStudents(prev => prev.map(s =>
              s.id === studentId
                ? {...s, feeStatus: 'paid', feeAmount: finalFee, feePaidOn: new Date()}
                : s
            ));
            try {
              await firestore()
                .collection('schools').doc(getSchoolCode())
                .collection('fees').doc(month)
                .collection('students').doc(studentId)
                .set({
                  id: studentId,
                  name: student.fullName || student.name || '',
                  class: student.class || '',
                  section: student.section || '',
                  amount: finalFee,
                  status: 'paid',
                  paidOn: firestore.FieldValue.serverTimestamp(),
                });
            } catch (e: any) {
              // Write failed — revert the optimistic change and tell the user.
              setStudents(prev => prev.map(s =>
                s.id === studentId
                  ? {...s, feeStatus: 'pending', feePaidOn: null}
                  : s
              ));
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  const markUnpaid = async (student: any) => {
    // Same id guard as markPaid — never write to .doc(undefined).
    const studentId = student.id;
    if (!studentId) {
      Alert.alert('Error', 'This student record has no ID and cannot be updated.');
      return;
    }
    Alert.alert('Mark as Unpaid?', `Remove ${student.fullName || student.name}'s payment?`,
      [
        {text: 'Cancel'},
        {
          text: 'Mark Unpaid',
          style: 'destructive',
          onPress: async () => {
            // Optimistic UI: flip this one student to "pending" immediately.
            setStudents(prev => prev.map(s =>
              s.id === studentId ? {...s, feeStatus: 'pending', feePaidOn: null} : s
            ));
            try {
              await firestore()
                .collection('schools').doc(getSchoolCode())
                .collection('fees').doc(month)
                .collection('students').doc(studentId)
                .set({
                  id: studentId,
                  name: student.fullName || student.name || '',
                  class: student.class || '',
                  section: student.section || '',
                  status: 'pending',
                });
            } catch (e: any) {
              // Write failed — revert the optimistic change back to paid.
              setStudents(prev => prev.map(s =>
                s.id === studentId ? {...s, feeStatus: 'paid'} : s
              ));
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  const filteredStudents = students.filter(s => {
    const classMatch = selectedClass === 'All' || s.class === selectedClass;
    const statusMatch = filterStatus === 'All' || s.feeStatus === filterStatus.toLowerCase();
    return classMatch && statusMatch;
  });

  const paidCount = students.filter(s => s.feeStatus === 'paid').length;
  const pendingCount = students.filter(s => s.feeStatus === 'pending').length;
  const collectionRate = students.length > 0
    ? Math.round((paidCount / students.length) * 100) : 0;

  const getFeeLabel = (student: any) => {
    const std = feeStructure[student.class] || 0;
    const final = calculateFee(student, std);
    if (!std) return 'Fee not set';
    if (student.feeType === 'full_scholarship') return 'Full Scholarship';
    if (student.feeType === 'scholarship') return `${student.feeDiscount}% Scholarship · PKR ${final.toLocaleString()}`;
    if (student.feeType === 'kinship') return `${student.feeDiscount}% Kinship · PKR ${final.toLocaleString()}`;
    if (student.feeType === 'discount') return `PKR ${student.feeDiscount} Off · PKR ${final.toLocaleString()}`;
    return `PKR ${final.toLocaleString()}`;
  };

  return (
    <View style={styles.root}>

      {/* FEE TYPE MODAL */}
      <Modal visible={!!feeModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Set Fee Type</Text>
              <TouchableOpacity onPress={() => setFeeModal(null)}>
                <XMarkIcon size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalStudent}>{feeModal?.fullName || feeModal?.name}</Text>
            <Text style={styles.modalClass}>{feeModal?.class} — Standard: PKR {(feeStructure[feeModal?.class] || 0).toLocaleString()}</Text>

            {/* Fee type selector */}
            <Text style={styles.modalLabel}>Fee Type</Text>
            <View style={styles.feeTypeGrid}>
              {FEE_TYPES.map(ft => (
                <TouchableOpacity key={ft.key}
                  style={[styles.feeTypeBtn, feeType === ft.key && styles.feeTypeBtnOn]}
                  onPress={() => setFeeType(ft.key)}>
                  <Text style={[styles.feeTypeTxt, feeType === ft.key && styles.feeTypeTxtOn]}>
                    {ft.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Discount input */}
            {(feeType === 'scholarship' || feeType === 'kinship') && (
              <View style={styles.discountBox}>
                <Text style={styles.modalLabel}>Discount Percentage</Text>
                <TextInput
                  style={styles.discountInput}
                  placeholder="e.g. 50"
                  placeholderTextColor="#b8a88a"
                  keyboardType="number-pad"
                  value={feeDiscount}
                  onChangeText={setFeeDiscount}
                />
                <Text style={styles.discountHint}>
                  Final fee: PKR {calculateFee(
                    {feeType, feeDiscount: parseInt(feeDiscount) || 0},
                    feeStructure[feeModal?.class] || 0
                  ).toLocaleString()}
                </Text>
              </View>
            )}

            {feeType === 'discount' && (
              <View style={styles.discountBox}>
                <Text style={styles.modalLabel}>Discount Amount (PKR)</Text>
                <TextInput
                  style={styles.discountInput}
                  placeholder="e.g. 1000"
                  placeholderTextColor="#b8a88a"
                  keyboardType="number-pad"
                  value={feeDiscount}
                  onChangeText={setFeeDiscount}
                />
                <Text style={styles.discountHint}>
                  Final fee: PKR {calculateFee(
                    {feeType, feeDiscount: parseInt(feeDiscount) || 0},
                    feeStructure[feeModal?.class] || 0
                  ).toLocaleString()}
                </Text>
              </View>
            )}

            {feeType === 'full_scholarship' && (
              <View style={styles.discountBox}>
                <Text style={[styles.discountHint, {color: '#16a34a'}]}>
                  Student will pay PKR 0 — Full Scholarship!
                </Text>
              </View>
            )}

            <TouchableOpacity style={styles.modalSaveBtn} onPress={saveFeeType}>
              <Text style={styles.modalSaveTxt}>Save Fee Type</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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

        {/* STUDENTS */}
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
              <View style={[styles.summaryCard, {backgroundColor: '#fdf8ee', borderColor: '#e8d5a3'}]}>
                <ChartBarIcon size={20} color="#B8960A" />
                <Text style={[styles.summaryVal, {color: '#B8960A'}]}>{collectionRate}%</Text>
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
              <ActivityIndicator color="#B8960A" size="large" style={{marginTop: 30}} />
            ) : filteredStudents.length === 0 ? (
              <View style={styles.emptyBox}>
                <BanknotesIcon size={40} color="#b8a88a" />
                <Text style={styles.emptyTxt}>
                  {students.length === 0 ? 'No students added yet' : 'No students match filter'}
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
                      <Text style={styles.studentMeta}>{s.class} — {s.section}</Text>
                      <Text style={[styles.feeLbl, {
                        color: s.feeType === 'full_scholarship' ? '#16a34a' :
                               s.feeType && s.feeType !== 'standard' ? '#B8960A' : '#6b7280'
                      }]}>
                        {getFeeLabel(s)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.studentActions}>
                    {/* Fee type button */}
                    <TouchableOpacity
                      style={styles.feeTypeIcon}
                      onPress={() => {
                        setFeeModal(s);
                        setFeeType(s.feeType || 'standard');
                        setFeeDiscount(s.feeDiscount ? String(s.feeDiscount) : '');
                      }}>
                      <UserIcon size={14} color="#B8960A" />
                    </TouchableOpacity>

                    {/* Paid/Pending button */}
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
                </View>
              ))
            )}

            <TouchableOpacity style={styles.refreshBtn} onPress={loadStudents}>
              <Text style={styles.refreshTxt}>Refresh</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STRUCTURE */}
        {activeTab === 'Structure' && (
          <View>
            <Text style={styles.sectionTitle}>Set Monthly Fee</Text>
            <Text style={styles.sectionSub}>Set standard fee per class. Individual discounts can be set per student.</Text>
            {CLASS_HIERARCHY.map((cat, i) => (
              <View key={i} style={styles.card}>
                <Text style={styles.catTitle}>{cat.category}</Text>
                {cat.classes.map((cls, j) => (
                  <View key={j} style={styles.feeRow}>
                    <Text style={styles.className}>{cls}</Text>
                    {feeStructure[cls] > 0 && (
                      <Text style={styles.currentFee}>PKR {feeStructure[cls].toLocaleString()}</Text>
                    )}
                    <View style={styles.feeInputRow}>
                      <Text style={styles.pkrLabel}>PKR</Text>
                      <TextInput
                        style={styles.feeInput}
                        placeholder="0"
                        placeholderTextColor="#b8a88a"
                        keyboardType="number-pad"
                        value={feeInputs[cls] || ''}
                        onChangeText={val => setFeeInputs(prev => ({...prev, [cls]: val}))}
                      />
                      <TouchableOpacity
                        style={styles.saveBtn}
                        onPress={() => saveFeeStructure(cls, feeInputs[cls] || '')}>
                        <Text style={styles.saveBtnTxt}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* REPORTS */}
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
                <Text style={[styles.reportVal, {color: '#B8960A'}]}>{collectionRate}%</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.reportRow}>
                <Text style={styles.reportLbl}>Scholarships</Text>
                <Text style={[styles.reportVal, {color: '#0284c7'}]}>
                  {students.filter(s => s.feeType && s.feeType !== 'standard').length}
                </Text>
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
  root: {flex: 1, backgroundColor: '#faf8f2'},
  subTabRow: {flexDirection: 'row', backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#ece5d3'},
  subTab: {flex: 1, paddingVertical: 11, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent'},
  subTabOn: {borderBottomColor: '#B8960A'},
  subTabTxt: {fontSize: 13, fontWeight: '500', color: '#9ca3af'},
  subTabTxtOn: {color: '#B8960A', fontWeight: '700'},
  content: {paddingHorizontal: 14, paddingTop: 14},
  summaryRow: {flexDirection: 'row', gap: 8, marginBottom: 14},
  summaryCard: {flex: 1, borderRadius: 12, padding: 12, alignItems: 'center', gap: 4, borderWidth: 1},
  summaryVal: {fontSize: 22, fontWeight: '700'},
  summaryLbl: {fontSize: 11, color: '#6b7280', fontWeight: '500'},
  filtersRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12},
  filterChip: {borderWidth: 1, borderColor: '#ece5d3', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#ffffff', marginRight: 6},
  filterChipOn: {borderColor: '#B8960A', backgroundColor: '#fdf8ee'},
  filterChipTxt: {fontSize: 12, fontWeight: '500', color: '#6b7280'},
  filterChipTxtOn: {color: '#B8960A', fontWeight: '700'},
  filterDivider: {width: 1, height: 20, backgroundColor: '#e5e7eb', marginHorizontal: 6},
  emptyBox: {alignItems: 'center', paddingVertical: 40, gap: 10},
  emptyTxt: {fontSize: 14, color: '#9ca3af', fontWeight: '500'},
  studentCard: {
    backgroundColor: '#ffffff', borderRadius: 12, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: '#ece5d3',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  studentLeft: {flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1},
  studentAv: {width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center'},
  studentAvTxt: {fontSize: 12, fontWeight: '700'},
  studentInfo: {flex: 1},
  studentName: {fontSize: 13, fontWeight: '600', color: '#0d1f3c'},
  studentMeta: {fontSize: 11, color: '#9ca3af', marginTop: 1},
  feeLbl: {fontSize: 11, marginTop: 2, fontWeight: '500'},
  studentActions: {flexDirection: 'column', alignItems: 'flex-end', gap: 6},
  feeTypeIcon: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: '#fdf8ee', borderWidth: 1, borderColor: '#ece5d3',
    alignItems: 'center', justifyContent: 'center',
  },
  statusBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4,
  },
  statusBtnPaid: {backgroundColor: '#f0fdf4', borderColor: '#86efac'},
  statusBtnPending: {backgroundColor: '#fef2f2', borderColor: '#fca5a5'},
  statusBtnTxt: {fontSize: 11, fontWeight: '700'},
  refreshBtn: {backgroundColor: '#ffffff', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#ece5d3', marginTop: 8},
  refreshTxt: {fontSize: 13, fontWeight: '600', color: '#B8960A'},
  sectionTitle: {fontSize: 17, fontWeight: '700', color: '#0d1f3c', marginBottom: 4},
  sectionSub: {fontSize: 12, color: '#9ca3af', marginBottom: 14},
  card: {backgroundColor: '#ffffff', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#ece5d3'},
  catTitle: {fontSize: 14, fontWeight: '700', color: '#0d1f3c', marginBottom: 10},
  feeRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6'},
  className: {fontSize: 13, fontWeight: '500', color: '#374151', flex: 1},
  currentFee: {fontSize: 11, color: '#B8960A', fontWeight: '600', marginRight: 8},
  feeInputRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  pkrLabel: {fontSize: 12, color: '#B8960A', fontWeight: '600'},
  feeInput: {backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#ece5d3', borderRadius: 8, padding: 7, fontSize: 13, color: '#0d1f3c', width: 70, textAlign: 'center'},
  saveBtn: {backgroundColor: '#0d1f3c', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7},
  saveBtnTxt: {color: '#C9A84C', fontSize: 11, fontWeight: '700'},
  reportCard: {backgroundColor: '#ffffff', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#ece5d3', marginBottom: 8},
  reportRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14},
  reportLbl: {fontSize: 13, color: '#6b7280', fontWeight: '500'},
  reportVal: {fontSize: 14, fontWeight: '700', color: '#0d1f3c'},
  divider: {height: 1, backgroundColor: '#f3f4f6'},
  progressRow: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10},
  progressCls: {fontSize: 12, fontWeight: '500', color: '#374151', width: 70},
  progressBar: {flex: 1, height: 6, backgroundColor: '#f3f4f6', borderRadius: 3, overflow: 'hidden'},
  progressFill: {height: '100%', backgroundColor: '#B8960A', borderRadius: 3},
  progressPct: {fontSize: 12, fontWeight: '700', color: '#B8960A', width: 35, textAlign: 'right'},
  // MODAL
  modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20},
  modalBox: {backgroundColor: '#ffffff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 360},
  modalHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8},
  modalTitle: {fontSize: 16, fontWeight: '700', color: '#0d1f3c'},
  modalStudent: {fontSize: 14, fontWeight: '600', color: '#0d1f3c', marginBottom: 2},
  modalClass: {fontSize: 12, color: '#6b7280', marginBottom: 14},
  modalLabel: {fontSize: 11, fontWeight: '600', color: '#B8960A', letterSpacing: 1, marginBottom: 8},
  modalValue: {fontSize: 12, color: '#0d1f3c', fontWeight: '600'},
  feeTypeGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14},
  feeTypeBtn: {borderWidth: 1, borderColor: '#ece5d3', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#ffffff'},
  feeTypeBtnOn: {borderColor: '#B8960A', backgroundColor: '#fdf8ee'},
  feeTypeTxt: {fontSize: 12, fontWeight: '500', color: '#6b7280'},
  feeTypeTxtOn: {color: '#B8960A', fontWeight: '700'},
  discountBox: {backgroundColor: '#fdf8ee', borderRadius: 10, padding: 12, marginBottom: 14},
  discountInput: {backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#ece5d3', borderRadius: 8, padding: 10, fontSize: 14, color: '#0d1f3c', marginTop: 4},
  discountHint: {fontSize: 12, color: '#B8960A', fontWeight: '600', marginTop: 6},
  modalSaveBtn: {backgroundColor: '#0d1f3c', borderRadius: 10, padding: 14, alignItems: 'center'},
  modalSaveTxt: {color: '#C9A84C', fontSize: 14, fontWeight: '700'},
});
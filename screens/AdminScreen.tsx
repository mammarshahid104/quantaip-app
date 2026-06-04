import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import {pick, types} from '@react-native-documents/picker';
import * as XLSX from 'xlsx';
import Share from 'react-native-share';
import {
  HomeIcon,
  AcademicCapIcon,
  UserGroupIcon,
  UserIcon,
  BanknotesIcon,
  ArrowUpTrayIcon,
  PlusCircleIcon,
  ArrowRightOnRectangleIcon,
  BuildingLibraryIcon,
  ChartBarIcon,
} from 'react-native-heroicons/outline';
import ClassesScreen from './ClassesScreen';
import FeeScreen from './FeeScreen';

const SCHOOL_CODE = 'GHS-001';

const CLASS_HIERARCHY = [
  {category: 'Early Education', classes: ['Nursery', 'Prep', 'KG']},
  {category: 'Primary', classes: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5']},
  {category: 'Middle', classes: ['Grade 6', 'Grade 7', 'Grade 8']},
  {category: 'Secondary', classes: ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12']},
];

const generateId = (role: string, index: number): string => {
  const roleCode: any = {teacher: 'TCH', student: 'STU', parent: 'PAR'};
  const num = String(index).padStart(4, '0');
  return `${SCHOOL_CODE}-${roleCode[role]}-${num}`;
};

const generatePass = (name: string): string => {
  const first = name.split(' ')[0];
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `${first}${num}`;
};

const TABS = [
  {key: 'Dashboard', icon: HomeIcon},
  {key: 'Classes', icon: BuildingLibraryIcon},
  {key: 'Students', icon: UserGroupIcon},
  {key: 'Teachers', icon: AcademicCapIcon},
  {key: 'Fee', icon: BanknotesIcon},
  {key: 'Import', icon: ArrowUpTrayIcon},
];

export default function AdminScreen({navigation}: any) {
  const [tab, setTab] = useState('Dashboard');
  const [loading, setLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState('');
  const [importProgress, setImportProgress] = useState('');
  const [importDone, setImportDone] = useState(false);
  const [stats, setStats] = useState({students: 0, teachers: 0});

  const [sName, setSName] = useState('');
  const [sFatherName, setSFatherName] = useState('');
  const [sSection, setSSection] = useState('');
  const [sRollNo, setSRollNo] = useState('');
  const [sDob, setSdob] = useState('');
  const [sParentPhone, setSParentPhone] = useState('');

  const [tName, setTName] = useState('');
  const [tSubject, setTSubject] = useState('');
  const [tPhone, setTPhone] = useState('');
  const [tClasses, setTClasses] = useState('');

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [sSnap, tSnap] = await Promise.all([
          firestore().collection('schools').doc(SCHOOL_CODE).collection('students').get(),
          firestore().collection('schools').doc(SCHOOL_CODE).collection('teachers').get(),
        ]);
        setStats({students: sSnap.size, teachers: tSnap.size});
      } catch (e) {}
    };
    loadStats();
  }, []);

  const STAT_CARDS = [
    {val: stats.students.toString(), lbl: 'Students', color: '#7c3aed', bg: '#f5f3ff', Icon: UserGroupIcon},
    {val: stats.teachers.toString(), lbl: 'Teachers', color: '#0891b2', bg: '#ecfeff', Icon: AcademicCapIcon},
    {val: '91%', lbl: 'Attendance', color: '#16a34a', bg: '#f0fdf4', Icon: ChartBarIcon},
    {val: '2.1M', lbl: 'PKR Fees', color: '#ea580c', bg: '#fff7ed', Icon: BanknotesIcon},
  ];

  const addStudent = async () => {
    if (!sName || !selectedClass || !sSection) {
      Alert.alert('Error', 'Name, Class and Section are required');
      return;
    }
    setLoading(true);
    try {
      const snapshot = await firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('students').get();

      const index = snapshot.size + 1;
      const studentId = generateId('student', index);
      const parentId = generateId('parent', index);
      const studentPass = generatePass(sName);
      const parentPass = generatePass(sName + ' Parent');

      await firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('students').doc(studentId)
        .set({
          id: studentId,
          fullName: sName,
          fatherName: sFatherName,
          class: selectedClass,
          section: sSection,
          rollNo: sRollNo,
          dob: sDob,
          parentPhone: sParentPhone,
          parentId,
          role: 'student',
          school: SCHOOL_CODE,
          status: 'active',
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

      // Save parent record too
      await firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('parents').doc(parentId)
        .set({
          id: parentId,
          studentId,
          studentName: sName,
          phone: sParentPhone,
          role: 'parent',
          school: SCHOOL_CODE,
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

      await auth().createUserWithEmailAndPassword(
        `${studentId.toLowerCase()}@quantaip.edu.pk`, studentPass,
      );

      await auth().createUserWithEmailAndPassword(
        `${parentId.toLowerCase()}@quantaip.edu.pk`, parentPass,
      );

      setStats(prev => ({...prev, students: prev.students + 1}));

      Alert.alert('Student Added ✅',
        `━━━━━━━━━━━━━━━━\nSTUDENT\nID: ${studentId}\nPassword: ${studentPass}\n\nPARENT\nID: ${parentId}\nPassword: ${parentPass}\n━━━━━━━━━━━━━━━━\nShare with student & parent.`);

      setSName(''); setSFatherName(''); setSSection('');
      setSRollNo(''); setSdob(''); setSParentPhone('');
      setSelectedClass('');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const addTeacher = async () => {
    if (!tName || !tSubject) {
      Alert.alert('Error', 'Name and Subject are required');
      return;
    }
    setLoading(true);
    try {
      const snapshot = await firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('teachers').get();

      const index = snapshot.size + 1;
      const teacherId = generateId('teacher', index);
      const defaultPass = generatePass(tName);

      await firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('teachers').doc(teacherId)
        .set({
          id: teacherId,
          name: tName,
          subject: tSubject,
          phone: tPhone,
          classesAssigned: tClasses.split(',').map((c: string) => c.trim()).filter(Boolean),
          role: 'teacher',
          school: SCHOOL_CODE,
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

      await auth().createUserWithEmailAndPassword(
        `${teacherId.toLowerCase()}@quantaip.edu.pk`, defaultPass,
      );

      setStats(prev => ({...prev, teachers: prev.teachers + 1}));

      Alert.alert('Teacher Added ✅',
        `━━━━━━━━━━━━━━━━\nTEACHER\nID: ${teacherId}\nPassword: ${defaultPass}\n━━━━━━━━━━━━━━━━\nShare with teacher.`);

      setTName(''); setTSubject(''); setTPhone(''); setTClasses('');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const importFromExcel = async () => {
    try {
      setImportDone(false);
      setImportProgress('Opening file picker...');

      const [result] = await pick({
        allowMultiSelection: false,
        type: [types.xlsx, types.xls],
      });

      setImportProgress('Reading Excel file...');

      const response = await fetch(result.uri);
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, {type: 'array'});

      let totalSuccess = 0;
      let totalError = 0;

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const data: any[] = XLSX.utils.sheet_to_json(sheet);
        if (data.length === 0) continue;

        setImportProgress(`Importing ${sheetName}... (${data.length} rows)`);

        const isTeacher = sheetName.toLowerCase().includes('teacher');
        const collection = isTeacher ? 'teachers' : 'students';

        const snapshot = await firestore()
          .collection('schools').doc(SCHOOL_CODE)
          .collection(collection).get();

        let currentIndex = snapshot.size;

        for (const row of data) {
          try {
            currentIndex++;
            const name = row['Name'] || row['name'] || '';
            if (!name) continue;

            const defaultPass = generatePass(name);

            if (isTeacher) {
              const teacherId = generateId('teacher', currentIndex);
              await firestore()
                .collection('schools').doc(SCHOOL_CODE)
                .collection('teachers').doc(teacherId)
                .set({
                  id: teacherId, name,
                  subject: row['Subject'] || '',
                  phone: row['Phone'] || '',
                  classesAssigned: (row['Classes Assigned'] || '').split(',').map((c: string) => c.trim()).filter(Boolean),
                  role: 'teacher', school: SCHOOL_CODE,
                  createdAt: firestore.FieldValue.serverTimestamp(),
                });
              await auth().createUserWithEmailAndPassword(
                `${teacherId.toLowerCase()}@quantaip.edu.pk`, defaultPass);
            } else {
              const studentId = generateId('student', currentIndex);
              const parentId = generateId('parent', currentIndex);
              const parentPass = generatePass(name + ' Parent');

              await firestore()
                .collection('schools').doc(SCHOOL_CODE)
                .collection('students').doc(studentId)
                .set({
                  id: studentId,
                  fullName: name,
                  fatherName: row['Father Name'] || '',
                  class: sheetName,
                  section: row['Section'] || 'A',
                  rollNo: row['Roll No'] || '',
                  parentPhone: row['Parent Phone'] || '',
                  parentId,
                  role: 'student',
                  school: SCHOOL_CODE,
                  status: 'active',
                  createdAt: firestore.FieldValue.serverTimestamp(),
                });

              await firestore()
                .collection('schools').doc(SCHOOL_CODE)
                .collection('parents').doc(parentId)
                .set({
                  id: parentId,
                  studentId,
                  studentName: name,
                  phone: row['Parent Phone'] || '',
                  role: 'parent',
                  school: SCHOOL_CODE,
                  createdAt: firestore.FieldValue.serverTimestamp(),
                });

              await auth().createUserWithEmailAndPassword(
                `${studentId.toLowerCase()}@quantaip.edu.pk`, defaultPass);
              await auth().createUserWithEmailAndPassword(
                `${parentId.toLowerCase()}@quantaip.edu.pk`, parentPass);
            }
            totalSuccess++;
            setImportProgress(`Importing... ${totalSuccess} done`);
          } catch (e) {
            totalError++;
          }
        }
      }

      setImportProgress(`Done! ${totalSuccess} imported, ${totalError} errors.`);
      setImportDone(true);
      Alert.alert('Import Complete ✅', `${totalSuccess} records imported!\n${totalError} errors.`);

    } catch (e: any) {
      setImportProgress('');
      if (e?.code !== 'OPERATION_CANCELED') {
        Alert.alert('Error', e.message);
      }
    }
  };
  const downloadTemplate = async () => {
  try {
    const RNBlobUtil = require('react-native-blob-util').default;

    const wb = XLSX.utils.book_new();

    const teacherData = [
      ['Name', 'Subject', 'Phone', 'Classes Assigned'],
      ['Mr. Qaiser', 'Mathematics', '0300-1234567', 'Grade 9, Grade 10'],
      ['Ms. Fatima', 'English', '0301-1234567', 'Grade 8, Grade 9'],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(teacherData), 'Teachers');

    const classData = [
      ['Name', 'Father Name', 'Section', 'Roll No', 'Parent Phone'],
      ['Ayesha Khan', 'Mr. Khan', 'A', '001', '0300-1234567'],
    ];

    CLASS_HIERARCHY.flatMap(c => c.classes).forEach(cls => {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(classData), cls);
    });

    const wbout = XLSX.write(wb, {type: 'base64', bookType: 'xlsx'});

    const path = `${RNBlobUtil.fs.dirs.CacheDir}/QUANTAIP_Template.xlsx`;
    await RNBlobUtil.fs.writeFile(path, wbout, 'base64');

    await RNBlobUtil.android.actionViewIntent(path,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

  } catch (e: any) {
    Alert.alert('Error', e.message);
  }
};
        
  return (
    <View style={styles.root}>

      <View style={styles.navbar}>
        <Text style={styles.brand}>QUANT<Text style={styles.brandAccent}>AIP</Text></Text>
        <TouchableOpacity
          style={styles.logoutIcon}
          onPress={() => {auth().signOut(); navigation.navigate('Login');}}>
          <ArrowRightOnRectangleIcon size={22} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={styles.tabScroll} contentContainerStyle={styles.tabRow}>
        {TABS.map(({key, icon: TabIcon}) => (
          <TouchableOpacity key={key}
            style={[styles.tab, tab === key && styles.tabOn]}
            onPress={() => setTab(key)}>
            <TabIcon size={16} color={tab === key ? '#7c3aed' : '#9ca3af'} />
            <Text style={[styles.tabTxt, tab === key && styles.tabTxtOn]}>{key}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.content}>

        {tab === 'Dashboard' && (
          <View>
            <View style={styles.welcomeCard}>
              <Text style={styles.welcomeEye}>DASHBOARD</Text>
              <Text style={styles.welcomeTitle}>
                Good morning, <Text style={styles.welcomeAccent}>Admin</Text>
              </Text>
              <Text style={styles.welcomeSub}>School Code: {SCHOOL_CODE}</Text>
            </View>

            <View style={styles.statsGrid}>
              {STAT_CARDS.map((s, i) => (
                <View key={i} style={[styles.statCard, {backgroundColor: s.bg, borderColor: s.color + '33'}]}>
                  <s.Icon size={20} color={s.color} />
                  <Text style={[styles.statVal, {color: s.color}]}>{s.val}</Text>
                  <Text style={styles.statLbl}>{s.lbl}</Text>
                </View>
              ))}
            </View>

            <View style={styles.quickGrid}>
              {[
                {label: 'Add Student', icon: UserIcon, tabKey: 'Students', color: '#7c3aed'},
                {label: 'Add Teacher', icon: AcademicCapIcon, tabKey: 'Teachers', color: '#0891b2'},
                {label: 'Import Data', icon: ArrowUpTrayIcon, tabKey: 'Import', color: '#16a34a'},
                {label: 'Fee Management', icon: BanknotesIcon, tabKey: 'Fee', color: '#ea580c'},
              ].map((item, i) => (
                <TouchableOpacity key={i} style={styles.quickBtn}
                  onPress={() => setTab(item.tabKey)}>
                  <View style={[styles.quickIconBox, {backgroundColor: item.color + '15'}]}>
                    <item.icon size={22} color={item.color} />
                  </View>
                  <Text style={styles.quickLbl}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {tab === 'Classes' && <ClassesScreen />}

        {tab === 'Students' && (
          <View>
            <Text style={styles.sectionTitle}>Add New Student</Text>
            <Text style={styles.fieldLabel}>SELECT CLASS *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 12}}>
              {CLASS_HIERARCHY.flatMap(c => c.classes).map((cls, i) => (
                <TouchableOpacity key={i}
                  style={[styles.clsChip, selectedClass === cls && styles.clsChipOn]}
                  onPress={() => setSelectedClass(cls)}>
                  <Text style={[styles.clsChipTxt, selectedClass === cls && styles.clsChipTxtOn]}>{cls}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.card}>
              {[
                {label: 'FULL NAME *', value: sName, setter: setSName, placeholder: 'e.g. Ayesha Khan'},
                {label: 'FATHER NAME', value: sFatherName, setter: setSFatherName, placeholder: 'e.g. Mr. Ahmed Khan'},
                {label: 'SECTION *', value: sSection, setter: setSSection, placeholder: 'e.g. A or Red'},
                {label: 'ROLL NUMBER', value: sRollNo, setter: setSRollNo, placeholder: 'e.g. 001', keyboard: 'number-pad'},
                {label: 'DATE OF BIRTH', value: sDob, setter: setSdob, placeholder: 'e.g. 2010-05-15'},
                {label: 'PARENT PHONE', value: sParentPhone, setter: setSParentPhone, placeholder: 'e.g. 0300-1234567', keyboard: 'phone-pad'},
              ].map((field, i) => (
                <View key={i} style={i > 0 ? {marginTop: 12} : {}}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <TextInput style={styles.input}
                    placeholder={field.placeholder}
                    placeholderTextColor="#c4b5fd"
                    value={field.value}
                    onChangeText={field.setter}
                    keyboardType={(field as any).keyboard || 'default'}
                  />
                </View>
              ))}

              {selectedClass ? (
                <View style={styles.selectedBadge}>
                  <AcademicCapIcon size={14} color="#16a34a" />
                  <Text style={styles.selectedBadgeTxt}>
                    {selectedClass} — Section: {sSection || '?'}
                  </Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.addBtn, !selectedClass && styles.addBtnDisabled]}
                onPress={addStudent} disabled={loading || !selectedClass}>
                {loading ? <ActivityIndicator color="#ffffff" /> :
                  <View style={styles.btnInner}>
                    <PlusCircleIcon size={18} color="#ffffff" />
                    <Text style={styles.addBtnTxt}>Add Student & Generate ID</Text>
                  </View>}
              </TouchableOpacity>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoTxt}>Student + Parent ID and passwords are auto-generated. Share them.</Text>
            </View>
          </View>
        )}

        {tab === 'Teachers' && (
          <View>
            <Text style={styles.sectionTitle}>Add New Teacher</Text>
            <View style={styles.card}>
              {[
                {label: 'FULL NAME *', value: tName, setter: setTName, placeholder: 'e.g. Mr. Qaiser'},
                {label: 'SUBJECT *', value: tSubject, setter: setTSubject, placeholder: 'e.g. Mathematics'},
                {label: 'PHONE', value: tPhone, setter: setTPhone, placeholder: 'e.g. 0300-1234567', keyboard: 'phone-pad'},
              ].map((field, i) => (
                <View key={i} style={i > 0 ? {marginTop: 12} : {}}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <TextInput style={styles.input}
                    placeholder={field.placeholder}
                    placeholderTextColor="#c4b5fd"
                    value={field.value}
                    onChangeText={field.setter}
                    keyboardType={(field as any).keyboard || 'default'}
                  />
                </View>
              ))}

              <View style={{marginTop: 12}}>
                <Text style={styles.fieldLabel}>CLASSES ASSIGNED</Text>
                <TextInput style={styles.input}
                  placeholder="e.g. Grade 9, Grade 10, Grade 11"
                  placeholderTextColor="#c4b5fd"
                  value={tClasses}
                  onChangeText={setTClasses}
                />
                <Text style={styles.inputHint}>Separate multiple classes with commas</Text>
              </View>

              <TouchableOpacity
                style={[styles.addBtn, {backgroundColor: '#0891b2'}]}
                onPress={addTeacher} disabled={loading}>
                {loading ? <ActivityIndicator color="#ffffff" /> :
                  <View style={styles.btnInner}>
                    <PlusCircleIcon size={18} color="#ffffff" />
                    <Text style={styles.addBtnTxt}>Add Teacher & Generate ID</Text>
                  </View>}
              </TouchableOpacity>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoTxt}>Teacher ID and password are auto-generated.</Text>
            </View>
          </View>
        )}

        {tab === 'Fee' && <FeeScreen />}

        {tab === 'Import' && (
          <View>
            <Text style={styles.sectionTitle}>Import from Excel</Text>
            <View style={styles.card}>
              <Text style={styles.importTitle}>Bulk Import</Text>
              <Text style={styles.importDesc}>
                Upload Excel file with multiple sheets. Each sheet = one class. "Teachers" sheet = teachers.
              </Text>

              <View style={styles.excelFormat}>
                <Text style={styles.excelFormatTitle}>Excel Sheet Structure:</Text>
                <Text style={styles.excelCol}>• Sheet "Teachers": Name, Subject, Phone, Classes Assigned</Text>
                <Text style={styles.excelCol}>• Sheet "Grade 9": Name, Father Name, Section, Roll No, Parent Phone</Text>
                <Text style={styles.excelCol}>• Each class gets its own sheet</Text>
              </View>

              {importProgress ? (
                <View style={styles.progressBox}>
                  <ActivityIndicator size="small" color="#16a34a" style={{marginRight: 8}} />
                  <Text style={styles.progressTxt}>{importProgress}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.addBtn, {backgroundColor: '#16a34a'}]}
                onPress={importFromExcel}>
                <View style={styles.btnInner}>
                  <ArrowUpTrayIcon size={18} color="#ffffff" />
                  <Text style={styles.addBtnTxt}>Select Excel File & Import</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.addBtn, {backgroundColor: '#0891b2', marginTop: 10}]}
                onPress={downloadTemplate}>
                <View style={styles.btnInner}>
                  <ArrowUpTrayIcon size={18} color="#ffffff" />
                  <Text style={styles.addBtnTxt}>Download Excel Template</Text>
                </View>
              </TouchableOpacity>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoTxt}>
                Download the template, fill in your data, then import.
              </Text>
            </View>
          </View>
        )}

        <View style={{height: 30}} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#faf5ff'},
  navbar: {
    backgroundColor: '#1e1b4b', paddingTop: 50, paddingBottom: 16,
    paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {fontSize: 20, fontWeight: '700', color: '#ffffff', letterSpacing: 2},
  brandAccent: {color: '#a78bfa'},
  logoutIcon: {padding: 4},
  tabScroll: {backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#ede9fe', maxHeight: 48},
  tabRow: {paddingHorizontal: 4},
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabOn: {borderBottomColor: '#7c3aed'},
  tabTxt: {fontSize: 12, fontWeight: '500', color: '#9ca3af'},
  tabTxtOn: {color: '#7c3aed', fontWeight: '700'},
  content: {flex: 1, paddingHorizontal: 14, paddingTop: 14},
  welcomeCard: {backgroundColor: '#1e1b4b', borderRadius: 16, padding: 20, marginBottom: 16},
  welcomeEye: {fontSize: 10, letterSpacing: 4, color: '#a78bfa', fontWeight: '600', marginBottom: 6},
  welcomeTitle: {fontSize: 22, fontWeight: '700', color: '#ffffff', marginBottom: 4},
  welcomeAccent: {color: '#a78bfa'},
  welcomeSub: {fontSize: 13, color: 'rgba(255,255,255,0.6)'},
  statsGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16},
  statCard: {width: '47%', borderRadius: 12, padding: 14, borderWidth: 1, gap: 6},
  statVal: {fontSize: 26, fontWeight: '700'},
  statLbl: {fontSize: 12, color: '#6b7280', fontWeight: '500'},
  quickGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16},
  quickBtn: {
    width: '47%', backgroundColor: '#ffffff', borderRadius: 12,
    padding: 16, alignItems: 'center', borderWidth: 1,
    borderColor: '#ede9fe', gap: 10,
  },
  quickIconBox: {width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center'},
  quickLbl: {fontSize: 13, fontWeight: '600', color: '#1e1b4b', textAlign: 'center'},
  sectionTitle: {fontSize: 17, fontWeight: '700', color: '#1e1b4b', marginBottom: 10},
  fieldLabel: {fontSize: 11, fontWeight: '600', color: '#7c3aed', letterSpacing: 2, marginBottom: 8},
  clsChip: {borderWidth: 1, borderColor: '#ede9fe', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#ffffff', marginRight: 6},
  clsChipOn: {borderColor: '#7c3aed', backgroundColor: '#f5f3ff'},
  clsChipTxt: {fontSize: 12, fontWeight: '500', color: '#6b7280'},
  clsChipTxtOn: {color: '#7c3aed', fontWeight: '700'},
  card: {backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#ede9fe'},
  input: {backgroundColor: '#f5f3ff', borderWidth: 1.5, borderColor: '#ede9fe', borderRadius: 10, padding: 13, fontSize: 14, color: '#1e1b4b', fontWeight: '500'},
  inputHint: {fontSize: 11, color: '#9ca3af', marginTop: 4},
  selectedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#f0fdf4', borderRadius: 8, padding: 10,
    marginTop: 12, borderWidth: 1, borderColor: '#bbf7d0',
  },
  selectedBadgeTxt: {fontSize: 13, color: '#16a34a', fontWeight: '600'},
  addBtn: {backgroundColor: '#7c3aed', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 16},
  addBtnDisabled: {backgroundColor: '#c4b5fd'},
  btnInner: {flexDirection: 'row', alignItems: 'center', gap: 8},
  addBtnTxt: {color: '#ffffff', fontSize: 14, fontWeight: '700'},
  infoCard: {backgroundColor: '#fffbeb', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#fde68a', marginBottom: 16},
  infoTxt: {fontSize: 13, color: '#92400e', lineHeight: 20},
  importTitle: {fontSize: 16, fontWeight: '700', color: '#1e1b4b', marginBottom: 8},
  importDesc: {fontSize: 13, color: '#6b7280', lineHeight: 20, marginBottom: 14},
  excelFormat: {backgroundColor: '#f5f3ff', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#ede9fe'},
  excelFormatTitle: {fontSize: 12, fontWeight: '700', color: '#7c3aed', marginBottom: 6},
  excelCol: {fontSize: 12, color: '#6b7280', marginBottom: 4, lineHeight: 18},
  progressBox: {flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf4', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#bbf7d0'},
  progressTxt: {fontSize: 13, color: '#16a34a', fontWeight: '600', flex: 1},
});
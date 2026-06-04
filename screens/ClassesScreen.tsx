import React, {useState} from 'react';
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
  PlusCircleIcon,
  TrashIcon,
  BuildingLibraryIcon,
} from 'react-native-heroicons/outline';

const SCHOOL_CODE = 'GHS-001';

const CLASS_HIERARCHY = [
  {category: 'Early Education', classes: ['Nursery', 'Prep', 'KG']},
  {category: 'Primary', classes: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5']},
  {category: 'Middle', classes: ['Grade 6', 'Grade 7', 'Grade 8']},
  {category: 'Secondary', classes: ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12']},
];

export default function ClassesScreen() {
  const [selectedClass, setSelectedClass] = useState('');
  const [sections, setSections] = useState<string[]>([]);
  const [newSection, setNewSection] = useState('');
  const [loading, setLoading] = useState(false);

  const loadSections = async (cls: string) => {
    setSelectedClass(cls);
    setLoading(true);
    try {
      const doc = await firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('classes').doc(cls)
        .get();
      if (doc.exists) {
        setSections(doc.data()?.sections || []);
      } else {
        setSections([]);
      }
    } catch (e) {
      setSections([]);
    } finally {
      setLoading(false);
    }
  };

  const addSection = async () => {
    if (!newSection.trim()) return;
    if (sections.includes(newSection.trim())) {
      Alert.alert('Error', 'Section already exists!');
      return;
    }
    setLoading(true);
    try {
      const updated = [...sections, newSection.trim()];
      await firestore()
        .collection('schools').doc(SCHOOL_CODE)
        .collection('classes').doc(selectedClass)
        .set(
          {sections: updated, updatedAt: firestore.FieldValue.serverTimestamp()},
          {merge: true},
        );
      setSections(updated);
      setNewSection('');
      Alert.alert('Done ✅', `Section "${newSection}" added to ${selectedClass}`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteSection = async (sec: string) => {
    Alert.alert('Delete Section?', `Remove "${sec}" from ${selectedClass}?`, [
      {text: 'Cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updated = sections.filter(s => s !== sec);
          await firestore()
            .collection('schools').doc(SCHOOL_CODE)
            .collection('classes').doc(selectedClass)
            .set({sections: updated}, {merge: true});
          setSections(updated);
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.root}>

      {/* CLASS LIST */}
      {CLASS_HIERARCHY.map((cat, i) => (
        <View key={i} style={styles.categoryBlock}>
          <Text style={styles.catTitle}>{cat.category}</Text>
          <View style={styles.classGrid}>
            {cat.classes.map((cls, j) => (
              <TouchableOpacity
                key={j}
                style={[styles.classCard, selectedClass === cls && styles.classCardOn]}
                onPress={() => loadSections(cls)}>
                <BuildingLibraryIcon
                  size={14}
                  color={selectedClass === cls ? '#7c3aed' : '#9ca3af'}
                />
                <Text style={[
                  styles.classCardTxt,
                  selectedClass === cls && styles.classCardTxtOn,
                ]}>
                  {cls}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      {/* SECTIONS */}
      {selectedClass ? (
        <View style={styles.sectionBox}>
          <Text style={styles.sectionTitle}>
            Sections —{' '}
            <Text style={{color: '#7c3aed'}}>{selectedClass}</Text>
          </Text>

          {loading ? (
            <ActivityIndicator color="#7c3aed" style={{marginVertical: 10}} />
          ) : sections.length === 0 ? (
            <Text style={styles.noSections}>
              No sections yet — add one below!
            </Text>
          ) : (
            <View style={styles.sectionList}>
              {sections.map((sec, i) => (
                <View key={i} style={styles.sectionItem}>
                  <Text style={styles.sectionName}>{sec}</Text>
                  <TouchableOpacity
                    onPress={() => deleteSection(sec)}
                    style={styles.deleteBtn}>
                    <TrashIcon size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* ADD SECTION */}
          <View style={styles.addRow}>
            <TextInput
              style={styles.sectionInput}
              placeholder="Section name (e.g. A, Red, Blue)"
              placeholderTextColor="#c4b5fd"
              value={newSection}
              onChangeText={setNewSection}
              autoCapitalize="words"
            />
            <TouchableOpacity
              style={styles.addBtn}
              onPress={addSection}
              disabled={loading}>
              <PlusCircleIcon size={18} color="#ffffff" />
              <Text style={styles.addBtnTxt}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.hintBox}>
          <BuildingLibraryIcon size={32} color="#c4b5fd" />
          <Text style={styles.hintTxt}>
            Select a class to manage its sections
          </Text>
        </View>
      )}

      <View style={{height: 30}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, paddingHorizontal: 14, paddingTop: 14},
  categoryBlock: {marginBottom: 18},
  catTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  classGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  classCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderColor: '#ede9fe',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: '#ffffff',
  },
  classCardOn: {borderColor: '#7c3aed', backgroundColor: '#f5f3ff'},
  classCardTxt: {fontSize: 13, fontWeight: '500', color: '#6b7280'},
  classCardTxtOn: {color: '#7c3aed', fontWeight: '700'},
  sectionBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ede9fe',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e1b4b',
    marginBottom: 12,
  },
  noSections: {
    fontSize: 13,
    color: '#9ca3af',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  sectionList: {marginBottom: 12},
  sectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sectionName: {fontSize: 14, fontWeight: '600', color: '#1e1b4b'},
  deleteBtn: {padding: 4},
  addRow: {flexDirection: 'row', gap: 8, alignItems: 'center'},
  sectionInput: {
    flex: 1,
    backgroundColor: '#f5f3ff',
    borderWidth: 1.5,
    borderColor: '#ede9fe',
    borderRadius: 10,
    padding: 11,
    fontSize: 14,
    color: '#1e1b4b',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#7c3aed',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  addBtnTxt: {color: '#ffffff', fontSize: 13, fontWeight: '700'},
  hintBox: {
    backgroundColor: '#f5f3ff',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#ede9fe',
    alignItems: 'center',
    gap: 10,
  },
  hintTxt: {
    fontSize: 13,
    color: '#7c3aed',
    fontWeight: '500',
    textAlign: 'center',
  },
});
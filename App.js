import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View, SafeAreaView, Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from './lib/supabase';

const C = {
  bg: '#fbf7f2', surface: '#ffffff', text: '#2a1d16', muted: '#7a6d64',
  accent: '#d9502b', accentSoft: '#fde7df', line: '#efe6dd',
};

const money = (cents) => `$${(cents / 100).toFixed(2)}`;
const makeCode = (prefix) => `${prefix}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

export default function App() {
  const [tab, setTab] = useState('menu');
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState({}); // id -> qty
  const [activeCat, setActiveCat] = useState('All');

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('menu_items').select('*').eq('is_available', true).order('category');
      if (error) Alert.alert('Menu load failed', error.message);
      setMenu(data || []);
      setLoading(false);
    })();
  }, []);

  const categories = useMemo(() => ['All', ...new Set(menu.map((m) => m.category))], [menu]);
  const visible = useMemo(
    () => (activeCat === 'All' ? menu : menu.filter((m) => m.category === activeCat)),
    [menu, activeCat]
  );

  const changeQty = (id, delta) =>
    setCart((prev) => {
      const next = { ...prev, [id]: Math.max(0, (prev[id] || 0) + delta) };
      if (next[id] === 0) delete next[id];
      return next;
    });

  const cartLines = Object.entries(cart).map(([id, qty]) => {
    const item = menu.find((m) => m.id === id);
    return { item, qty };
  }).filter((l) => l.item);

  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0);
  const cartTotal = cartLines.reduce((s, l) => s + l.item.price_cents * l.qty, 0);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.brand}>Aman's Café</Text>
        <Text style={styles.sub}>Wood-fired kitchen</Text>
        <View style={styles.tabs}>
          {[['menu', 'Menu'], ['cart', `Cart (${cartCount})`], ['book', 'Book a table']].map(([key, label]) => (
            <Pressable key={key} onPress={() => setTab(key)} style={[styles.tab, tab === key && styles.tabActive]}>
              <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {tab === 'menu' && (
        <MenuView
          loading={loading} categories={categories} activeCat={activeCat} setActiveCat={setActiveCat}
          items={visible} cart={cart} changeQty={changeQty}
        />
      )}
      {tab === 'cart' && (
        <CartView lines={cartLines} total={cartTotal} changeQty={changeQty}
          onPlaced={() => { setCart({}); setTab('menu'); }} />
      )}
      {tab === 'book' && <BookView />}
    </SafeAreaView>
  );
}

function MenuView({ loading, categories, activeCat, setActiveCat, items, cart, changeQty }) {
  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={C.accent} />;
  return (
    <View style={{ flex: 1 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsWrap}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {categories.map((c) => (
          <Pressable key={c} onPress={() => setActiveCat(c)}
            style={[styles.chip, activeCat === c && styles.chipActive]}>
            <Text style={[styles.chipText, activeCat === c && styles.chipTextActive]}>{c}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => {
          const qty = cart[item.id] || 0;
          return (
            <View style={styles.card}>
              <View style={styles.emojiBox}><Text style={{ fontSize: 30 }}>{item.emoji || '🍽️'}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.dishName}>{item.name}</Text>
                <Text style={styles.dishDesc}>{item.description}</Text>
                <View style={styles.rowBetween}>
                  <Text style={styles.price}>{money(item.price_cents)}</Text>
                  {qty === 0 ? (
                    <Pressable style={styles.addBtn} onPress={() => changeQty(item.id, 1)}>
                      <Text style={styles.addBtnText}>Add</Text>
                    </Pressable>
                  ) : (
                    <View style={styles.qtyRow}>
                      <Pressable style={styles.qtyBtn} onPress={() => changeQty(item.id, -1)}><Text style={styles.qtyBtnText}>−</Text></Pressable>
                      <Text style={styles.qtyText}>{qty}</Text>
                      <Pressable style={styles.qtyBtn} onPress={() => changeQty(item.id, 1)}><Text style={styles.qtyBtnText}>+</Text></Pressable>
                    </View>
                  )}
                </View>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

function CartView({ lines, total, changeQty, onPlaced }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [orderType, setOrderType] = useState('pickup');
  const [sending, setSending] = useState(false);

  if (lines.length === 0) {
    return <Text style={styles.empty}>तुम्हारा cart खाली है। Menu से कुछ चुनो।</Text>;
  }

  const canPlace = name.trim() && phone.trim().length >= 7 && !sending;

  const placeOrder = async () => {
    setSending(true);
    const code = makeCode('AC');
    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        order_code: code, customer_name: name.trim(), customer_phone: phone.trim(),
        order_type: orderType, total_cents: total,
      })
      .select('id')
      .single();

    if (error || !order) {
      setSending(false);
      Alert.alert('Order नहीं हुआ', error?.message || 'कुछ गलत हो गया');
      return;
    }

    const items = lines.map((l) => ({
      order_id: order.id, menu_item_id: l.item.id, item_name: l.item.name,
      quantity: l.qty, unit_price_cents: l.item.price_cents,
    }));
    const { error: itemsError } = await supabase.from('order_items').insert(items);
    setSending(false);

    if (itemsError) {
      Alert.alert('Items save नहीं हुए', itemsError.message);
      return;
    }
    Alert.alert('Order placed ✓', `Order code: ${code}`);
    onPlaced();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      {lines.map(({ item, qty }) => (
        <View key={item.id} style={styles.lineRow}>
          <Text style={{ flex: 1, color: C.text }}>{qty} × {item.name}</Text>
          <Text style={styles.price}>{money(item.price_cents * qty)}</Text>
          <Pressable onPress={() => changeQty(item.id, -qty)}><Text style={styles.remove}>हटाएँ</Text></Pressable>
        </View>
      ))}
      <View style={styles.rowBetween}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{money(total)}</Text>
      </View>

      <View style={styles.segment}>
        {[['pickup', 'Pickup'], ['delivery', 'Delivery']].map(([k, l]) => (
          <Pressable key={k} onPress={() => setOrderType(k)} style={[styles.segBtn, orderType === k && styles.segBtnActive]}>
            <Text style={[styles.segText, orderType === k && { color: '#fff' }]}>{l}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput style={styles.input} placeholder="आपका नाम" value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="फ़ोन नंबर" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
      <Pressable disabled={!canPlace} onPress={placeOrder}
        style={[styles.primary, !canPlace && { opacity: 0.45 }]}>
        <Text style={styles.primaryText}>{sending ? 'भेजा जा रहा है...' : 'Order place करें'}</Text>
      </Pressable>
    </ScrollView>
  );
}

function BookView() {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('19:00');
  const [guests, setGuests] = useState(2);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  const times = ['12:00', '12:30', '13:30', '18:00', '19:00', '20:00'];
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const canBook = validDate && name.trim() && phone.trim().length >= 7 && !sending;

  const book = async () => {
    setSending(true);
    const code = makeCode('TB');
    const { error } = await supabase.from('reservations').insert({
      confirmation_code: code, customer_name: name.trim(), customer_phone: phone.trim(),
      reservation_date: date, reservation_time: time, guests, special_request: note.trim() || null,
    });
    setSending(false);
    if (error) return Alert.alert('Booking नहीं हुआ', error.message);
    Alert.alert('Table reserved ✓', `Confirmation: ${code}`);
    setName(''); setPhone(''); setNote(''); setDate('');
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <TextInput style={styles.input} placeholder="तारीख (YYYY-MM-DD)" value={date} onChangeText={setDate} />
      <Text style={styles.label}>समय</Text>
      <View style={styles.wrapRow}>
        {times.map((t) => (
          <Pressable key={t} onPress={() => setTime(t)} style={[styles.chip, time === t && styles.chipActive]}>
            <Text style={[styles.chipText, time === t && styles.chipTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>लोग</Text>
      <View style={styles.wrapRow}>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
          <Pressable key={n} onPress={() => setGuests(n)} style={[styles.chip, guests === n && styles.chipActive]}>
            <Text style={[styles.chipText, guests === n && styles.chipTextActive]}>{n}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput style={styles.input} placeholder="आपका नाम" value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="फ़ोन नंबर" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
      <TextInput style={[styles.input, { height: 80 }]} placeholder="ख़ास request (वैकल्पिक)" multiline value={note} onChangeText={setNote} />
      <Pressable disabled={!canBook} onPress={book} style={[styles.primary, !canBook && { opacity: 0.45 }]}>
        <Text style={styles.primaryText}>{sending ? 'Booking हो रही है...' : 'Table book करें'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg, paddingTop: Platform.OS === 'android' ? 30 : 0 },
  header: { backgroundColor: '#2a1d16', padding: 20, paddingBottom: 14 },
  brand: { color: '#fff', fontSize: 22, fontWeight: '700' },
  sub: { color: '#f3d9cc', fontSize: 13, marginTop: 2 },
  tabs: { flexDirection: 'row', marginTop: 14, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: 4 },
  tab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 11 },
  tabActive: { backgroundColor: '#fff' },
  tabText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: C.text },
  chipsWrap: { paddingVertical: 12, flexGrow: 0 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line },
  chipActive: { backgroundColor: C.text, borderColor: C.text },
  chipText: { color: C.muted, fontWeight: '600' },
  chipTextActive: { color: C.bg },
  card: { flexDirection: 'row', gap: 12, backgroundColor: C.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: C.line, alignItems: 'center' },
  emojiBox: { width: 64, height: 64, borderRadius: 14, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' },
  dishName: { fontSize: 16, fontWeight: '700', color: C.text },
  dishDesc: { fontSize: 13, color: C.muted, marginTop: 2 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  price: { color: C.accent, fontWeight: '700', fontSize: 15 },
  addBtn: { backgroundColor: C.accent, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  addBtnText: { color: '#fff', fontWeight: '700' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: { width: 30, height: 30, borderRadius: 9, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { color: C.accent, fontSize: 18, fontWeight: '700' },
  qtyText: { fontWeight: '700', minWidth: 18, textAlign: 'center', color: C.text },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.surface, padding: 14, borderRadius: 12 },
  remove: { color: C.accent, fontWeight: '600' },
  totalLabel: { fontSize: 17, fontWeight: '700', color: C.text },
  totalValue: { fontSize: 17, fontWeight: '800', color: C.text },
  segment: { flexDirection: 'row', backgroundColor: C.surface, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: C.line },
  segBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 9 },
  segBtnActive: { backgroundColor: C.accent },
  segText: { fontWeight: '600', color: C.text },
  input: { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.line, padding: 14, fontSize: 15, color: C.text },
  label: { fontWeight: '600', color: C.muted, marginTop: 4 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primary: { backgroundColor: C.accent, padding: 15, borderRadius: 14, alignItems: 'center', marginTop: 6 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  empty: { textAlign: 'center', color: C.muted, marginTop: 40 },
});

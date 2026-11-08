// Standalone, deterministic room activities. No timers or global event listeners.
// All UI lives in the host's modal; replacing/closing it leaves no work running.
const A=(kind,title,instructions,settings)=>({kind,title,instructions,...settings});
const seq=(title,instructions,buttons,answer,extra={})=>A('sequence',title,instructions,{buttons,answer,...extra});
const dial=(title,instructions,labels,target,extra={})=>A('dials',title,instructions,{labels,target,initial:target.map(()=>0),max:12,...extra});
const order=(title,instructions,items,initial)=>A('order',title,instructions,{items,initial,target:items.map((_,i)=>i)});
const grid=(title,instructions,size,start,goal,blocked,checkpoints,solution,extra={})=>A('grid',title,instructions,{size,start,goal,blocked,checkpoints,solution,...extra});
export const ACTIVITIES={
 'great-hall':dial('Wieczorna konstelacja świec','Przygotuj cztery stoły do uczty. Gryffindor potrzebuje 3 świec, Slytherin 4, Ravenclaw 2, Hufflepuff 3. Każde + zapala jedną świecę; − pozwala ją zdjąć. Zatwierdź, gdy wszystkie stoły będą gotowe.',['Stół lwa','Stół węża','Stół orła','Stół borsuka'],[3,4,2,3],{max:6,unit:'świece',prop:'candles',symbol:'✦'}),
 transfiguration:dial('Od drewna do srebrnej igły','Dopasuj trzy cechy zapałki. Igła ma być srebrna, smukła i mieć długość 4 jednostek. Każda zmiana przebudowuje przedmiot na pergaminie.',['Materiał','Kształt','Długość'],[2,1,4],{maxes:[2,2,6],options:[['Drewno','Miedź','Srebro'],['Kostka','Igła','Kula'],null],prop:'needle',symbol:'↟'}),
 charms:A('vector','Piórko w równowadze','Doprowadź piórko na wysokość 4, bez bocznego dryfu (0). Uniesienie zwiększa wysokość i dryf. Uspokojenie zmniejsza dryf. Nie przekraczaj granic skali.',{labels:['Wysokość','Boczny dryf'],initial:[0,0],target:[4,0],min:[0,-3],max:[6,3],buttons:['Unieś ↟','Uspokój ←','Opuść ↡'],vectors:[[1,1],[0,-1],[-1,0]],solution:[0,1,0,1,0,1,0,1],prop:'feather',symbol:'〰'}),
 potions:seq('Kociołek spokojnego snu','Wykonaj recepturę: woda → lawenda → obrót w lewo → lawenda → obrót w prawo → mały płomień. Pomyłka wygasza kocioł; możesz od razu zacząć ponownie. To wyłącznie fikcyjna receptura w grze.',['Woda ≈','Lawenda ❧','Mieszaj ↶','Mieszaj ↷','Mały płomień ♨'],[0,1,2,1,3,4],{prop:'cauldron',symbol:'♨'}),
 defence:A('defence','Tarcza na właściwej stronie','Odczytaj kierunek kolejnego impulsu i ustaw osłonę po tej samej stronie. Odbij sześć impulsów. Trzy pomyłki rozpoczynają ćwiczenie od nowa. Nie ma limitu czasu.',{buttons:['Lewa tarcza ←','Górna tarcza ↑','Prawa tarcza →'],answer:[0,2,1,2,0,1],prop:'shield',symbol:'◇'}),
 herbology:dial('Przesadzanie trzech mandragor','Wyreguluj wodę i światło dla każdej doniczki. Sadzonka: woda 2, światło 1. Młoda mandragora: woda 3, światło 2. Dorosła: woda 1, światło 3. Nauszniki są już założone.',['Sadzonka · woda','Sadzonka · światło','Młoda · woda','Młoda · światło','Dorosła · woda','Dorosła · światło'],[2,1,3,2,1,3],{max:4,prop:'plants',symbol:'❧'}),
 divination:dial('Znaki na dnie filiżanki','Obróć trzy kręgi fusów według zapisu Trelawney: na zewnątrz gwiazda, w środku księżyc, przy uchu klucz. Symbole przesuwasz w obie strony, a nie wybierasz z listy odpowiedzi.',['Zewnętrzny krąg','Środkowy krąg','Wewnętrzny krąg'],[3,1,4],{max:5,wrap:true,options:Array(3).fill(['Liść ❧','Księżyc ☾','Oko ◉','Gwiazda ✦','Klucz ⚿','Fala ≈']),prop:'teacup',symbol:'☾'}),
 'astronomy-class':A('connect','Mapa gwiazdozbioru','Połącz gwiazdy w kolejności ich jasności: 1 → 2 → 3 → 4 → 5 → 6. Linie zostaną na mapie. Błędna gwiazda cofa rysunek do początku.',{buttons:['4 · Deneb','1 · Vega','6 · Albireo','3 · Altair','2 · Sheliak','5 · Sadr'],answer:[1,4,3,0,5,2],points:[[15,22],[52,12],[82,78],[79,34],[37,41],[24,80]],prop:'orrery',symbol:'✧'}),
 history:order('Kronika szkolnego roku','Ustaw pięć kart od najwcześniejszego wydarzenia do najpóźniejszego. Przenoś je strzałkami w górę i w dół. Karty opisują tę autorską szkolną kronikę.',['1 września · Przyjazd pociągu','31 października · Uczta','25 grudnia · Święta','1 maja · Próby zaklęć','30 czerwca · Powrót do domu'],[2,4,1,0,3]),
 runes:A('lights','Kamień z dziewięcioma runami','Wygasz wszystkie runy. Dotknięcie pola odwraca jego stan oraz stan pól nad nim, pod nim i po bokach. Złote pole jest aktywne. Układ zawsze ma rozwiązanie.',{size:3,initial:[1,1,0,1,0,1,0,1,1],cross:true,solution:[0,8],prop:'runestone',symbol:'ᚱ'}),
 arithmancy:A('numbergrid','Kwadrat piętnastu','Uzupełnij cztery puste pola cyframi 1–9. Każda cyfra może wystąpić raz. Każdy wiersz, kolumna i obie przekątne muszą mieć sumę 15. Stałych cyfr nie można zmieniać.',{size:3,initial:[8,0,6,0,5,0,4,0,2],target:[8,1,6,3,5,7,4,9,2],prop:'numbercube',symbol:'15'}),
 'muggle-studies':A('lights','Światło bez różdżki','Zapal wszystkie cztery lampki obwodu. Każdy przełącznik zmienia lampki opisane na jego etykiecie. Możesz wielokrotnie przełączać ten sam styk.',{size:2,initial:[0,0,0,0],target:[1,1,1,1],effects:[[0,1],[1,2],[2,3],[0,2]],labels:['Styk A · lampki 1, 2','Styk B · lampki 2, 3','Styk C · lampki 3, 4','Styk D · lampki 1, 3'],solution:[0,2],prop:'circuit',symbol:'ϟ'}),
 creatures:seq('Pierwsze spotkanie z hipogryfem','Postępuj spokojnie: zatrzymaj się → ukłoń się → poczekaj na ukłon → wyciągnij dłoń → podaj smakołyk. Hagrid opisze reakcję po każdym kroku. Nie dotykaj zwierzęcia przed powitaniem.',['Zatrzymaj się','Ukłoń się','Poczekaj','Wyciągnij dłoń','Smakołyk'],[0,1,2,3,4],{responses:['Hipogryf uważnie Cię obserwuje.','Pochyla głowę, ale jeszcze nie podchodzi.','Odwzajemnia ukłon.','Spokojnie dotyka dłoni dziobem.','Pierwszy kontakt zakończył się sukcesem.'],prop:'hippogriff',symbol:'♞'}),
 flying:grid('Slalom na małej miotle','Przeleć przez trzy złote obręcze w kolejności 1, 2, 3, a potem dotrzyj do flagi. Mgła blokuje pole. Używaj strzałek; możesz cofnąć się i poprawić trasę.',5,20,4,[6,10,14,18],[16,12,8],['up','right','right','up','right','up','right','up'],{prop:'broom',symbol:'↗'}),
 alchemy:dial('Trzy składniki złotego stopu','Ustaw proporcje umownego stopu: 2 porcje srebrnego pyłu, 3 porcje bursztynu i 1 porcja księżycowej soli. Masa musi wynosić 6, a stosunek pierwszych dwóch składników 2:3.',['Srebrny pył','Bursztyn','Księżycowa sól'],[2,3,1],{max:6,unit:'porcje',prop:'balance',symbol:'⚖'}),
 apparition:grid('Cel, determinacja, namysł','Teleportuj znacznik wyłącznie o dwa pola w poziomie lub pionie. Odwiedź kolejno kręgi 1 i 2, potem gwiazdę. Na pole z blokadą nie można się przenieść.',5,20,4,[6,8,16],[10,2],['up','up','right','right'],{jump:2,prop:'portals',symbol:'◎'}),
 library:order('Księgi na właściwej półce','Ułóż grzbiety alfabetycznie według tytułu, od A do Z. Pani Pince pozwala przesuwać po jednej księdze. Półka zaakceptuje dopiero cały poprawny rząd.',['Astronomia dla dociekliwych','Bestiariusz szkolny','Historia Hogwartu','O zaklęciach ochronnych','Zielnik młodego czarodzieja'],[4,1,3,0,2]),
 restricted:A('match','Pieczęcie zamkniętej księgi','Połącz symbol na zamku z odpowiadającą mu ochroną. Wybierz pieczęć po lewej, a następnie jej parę po prawej. Wskazówka: płomień gaśnie w wodzie, cień ustępuje światłu, kolec osłonie, a cisza dźwiękowi.',{left:['Płomień ♨','Cień ◐','Kolec ↟','Cisza ○'],right:['Woda ≈','Światło ☼','Osłona ◇','Dźwięk ♫'],rightOrder:[2,0,3,1],prop:'sealedbook',symbol:'⚿'}),
 gryffindor:grid('Próba odważnego skoczka','Poprowadź figurę ruchem szachowego skoczka: dwa pola w jednym kierunku i jedno w drugim. Odwiedź znaczniki 1, 2, 3 w kolejności i zakończ przy gwieździe. Klikaj dostępne pola.',4,12,8,[3,4,6],[5,14,7],[5,14,7,1,8],{knight:true,prop:'chess',symbol:'♞'}),
 slytherin:dial('Wężowy kanał','Obróć pięć segmentów srebrnego węża, aby odtworzyć ścieżkę ze szkicu: → ↓ → ↑ →. Każdy segment musi wskazywać kolejny zakręt. Obrót zawija po pełnym okrążeniu.',['Głowa','Pierwszy łuk','Środek','Drugi łuk','Ogon'],[1,2,1,0,1],{max:3,wrap:true,options:Array(5).fill(['↑','→','↓','←']),prop:'snake',symbol:'≈'}),
 ravenclaw:dial('Trzy liczby kołatki','Znajdź dodatnie liczby A, B, C. Warunki: A + B = 7, B − C = 2 oraz A × C = 6. Ustaw liczby na pierścieniach i sprawdź równania.',['A','B','C'],[2,5,3],{initial:[1,1,1],min:1,max:9,equations:true,prop:'eagle',symbol:'∞'}),
 hufflepuff:A('memorySequence','Rytm beczek przy kuchni','Zapamiętaj rytm: lewa, lewa, środkowa, prawa, środkowa, lewa. Ukryj zapis i wystukaj go na trzech beczkach. Możesz ponownie obejrzeć wzór; nie ma pośpiechu.',{buttons:['Lewa beczka','Środkowa beczka','Prawa beczka'],answer:[0,0,1,2,1,0],prop:'barrels',symbol:'♧'}),
 headmaster:order('Wspomnienia w myślodsiewni','Ułóż cztery fiolki według pory dnia we wspomnieniu, od świtu do nocy. Każda poprawka przesuwa jedną fiolkę w strumieniu srebrzystej pamięci.',['Świt · rosa na błoniach','Południe · światło w bibliotece','Zmierzch · lampy Hogsmeade','Noc · gwiazdy nad wieżą'],[2,0,3,1]),
 owlery:A('assign','Sowia poczta','Rozdziel pięć paczek pomiędzy trzy sowy. Waga ładunków musi dokładnie odpowiadać ich udźwigowi: Płomyk 4, Chmurka 5, Popiół 6. Wybierz paczkę, potem sowę. Paczkę możesz przenieść ponownie.',{items:['Listy · 1','Atlas · 2','Pergaminy · 3','Luneta · 4','Księga · 5'],bins:['Płomyk · udźwig 4','Chmurka · udźwig 5','Popiół · udźwig 6'],weights:[1,2,3,4,5],capacities:[4,5,6],solution:[2,2,2,0,1],prop:'owls',symbol:'✉'}),
 kitchens:dial('Uczta dla sześciu','Przepis dla 2 osób wymaga: 2 ziemniaków, 3 marchewek, 1 cebuli i 4 miarek wody. Przygotuj dokładnie trzy razy większą porcję dla 6 osób, regulując zapasy.',['Ziemniaki','Marchewki','Cebule','Miarki wody'],[6,9,3,12],{max:15,prop:'food',symbol:'♨'}),
 hospital:seq('Spokojna pomoc skrzydła szpitalnego','W tym fikcyjnym ćwiczeniu Pomfrey poleca: osłoń miejsce → wezwij Pomfrey → przygotuj czysty bandaż → podaj bandaż → zapisz obserwację. Nie podawaj samodzielnie eliksirów; to scenka gry.',['Osłoń miejsce','Wezwij Pomfrey','Czysty bandaż','Podaj bandaż','Zapisz obserwację','Sięgnij po eliksir'],[0,1,2,3,4],{prop:'bandages',symbol:'✚'}),
 prefects:dial('Kąpiel o właściwej temperaturze','Napełnij wannę 10 miarkami wody o temperaturze 40°. Gorący kran daje 70°, chłodny 20°. Dodawaj i usuwaj pełne miarki; podgląd wylicza temperaturę mieszaniny.',['Gorący kran · 70°','Chłodny kran · 20°'],[4,6],{max:10,waterMix:true,prop:'taps',symbol:'≈'}),
 myrtle:A('lights','Lustrzane krople Marty','Wygasz krople na lustrze. Dotknięcie pola odwraca również jego odbicie po przeciwnej stronie środkowej kolumny. Środkowa kropla zmienia się tylko raz.',{size:3,initial:[1,0,1,0,1,0,1,0,1],mirror:true,solution:[0,4,6],prop:'mirror',symbol:'◈'}),
 requirement:A('assign','Pokój, którego potrzebujesz','Przygotuj trzy kąciki: nauka, odpoczynek i trening. Przenieś do nich przedmioty zgodnie z potrzebą. Księga i pergamin służą nauce; fotel i poduszka odpoczynkowi; manekin i tarcza treningowi.',{items:['Manekin','Księga','Fotel','Pergamin','Tarcza','Poduszka'],bins:['Nauka','Odpoczynek','Trening'],target:[2,0,1,0,2,1],prop:'changingroom',symbol:'◇'}),
 chamber:seq('Szept kamiennego węża','Odtwórz wzór wyryty wokół zamka: krótki syk, długi syk, krótki syk, pauza, długi syk, pauza. Każdy znak porusza jednym z sześciu kręgów. Nie musisz mówić do mikrofonu.',['Krótki syk ·','Długi syk —','Pauza ○'],[0,1,0,2,1,2],{prop:'serpentdoor',symbol:'ᛊ'}),
 stairs:grid('Schody, które wybierają drogę','Wejdź na dźwignię ⚙, aby otworzyć środkowy most. Potem przejdź przez złoty podest 1 i dotrzyj do gwiazdy. Ciemne pola to przepaść; poruszasz się tylko na sąsiednie pola.',5,20,4,[5,6,8,9,10,11,13,14],[7],['right','up','right','up','up','up','right','right'],{switchCell:21,gate:12,prop:'stairs',symbol:'⌁'}),
 entrance:A('assign','Przyjazd czterech domów','Przyporządkuj osiem kufrów do oznaczonych wieszaków. Lew — Gryffindor, wąż — Slytherin, orzeł — Ravenclaw, borsuk — Hufflepuff. Wybierz kufer i kliknij wieszak.',{items:['Kufer z orłem','Kufer z lwem','Kufer z borsukiem','Kufer z wężem','Torba z lwem','Torba z orłem','Torba z wężem','Torba z borsukiem'],bins:['Gryffindor · lew','Slytherin · wąż','Ravenclaw · orzeł','Hufflepuff · borsuk'],target:[2,0,3,1,0,2,1,3],prop:'luggage',symbol:'✉'}),
 trophy:order('Gabloty szkolnych osiągnięć','Ustaw puchary od najmniejszej do największej liczby wygrawerowanych punktów. Przesuwaj podstawy pojedynczo; nie sortuj według koloru metalu.',['Brązowy puchar · 40 pkt','Złoty puchar · 75 pkt','Srebrny puchar · 110 pkt','Miedziany puchar · 125 pkt','Kryształowy puchar · 180 pkt'],[4,1,3,0,2]),
 duelling:A('duel','Pojedynek trzech taktyk','Pokonaj treningowe echo. W jego turze „atak” osłona blokuje cios. Podczas „tarczy” odzyskaj skupienie. Gdy „zbiera moc”, atakuj. Atak zużywa 1 skupienie i zadaje 12 obrażeń; echo ma 36 wytrzymałości. Wszystko działa turowo.',{prop:'duel',symbol:'ϟ'}),
 repair:A('sliding','Dziewięć fragmentów filiżanki','Przesuwaj kafelki sąsiadujące z pustym polem, aby odtworzyć kolejność 1–8 wierszami i zostawić puste pole w prawym dolnym rogu. Ruchy działają jak klasyczna układanka przesuwna.',{size:3,scramble:[7,4,3,6,7,8,5,4,1,2,5],prop:'brokenCup',symbol:'↻'}),
 patronus:A('memory','Wspomnienia, które dają światło','Odkryj cztery pary wspomnień. Klikaj po dwie karty. Jeśli para nie pasuje, kolejny klik ją zakryje i rozpocznie następną próbę. Nie ma ograniczenia czasu.',{cards:['☼','♫','❧','☼','♡','❧','♫','♡'],names:{'☼':'Słoneczny poranek','♫':'Wspólna piosenka','❧':'Spacer po ogrodzie','♡':'Spotkanie z bliskimi'},prop:'stag',symbol:'♡'}),
 water:A('jugs','Dokładnie cztery miarki','Masz dzbany o pojemnościach 5 i 3. Napełniaj, opróżniaj i przelewaj do pełna. Uzyskaj dokładnie 4 miarki w większym dzbanie. Woda jest umowna; żadnych kosztów ani limitu czasu.',{sizes:[5,3],target:4,solution:['fill0','pour01','empty1','pour01','fill0','pour01'],prop:'jugs',symbol:'≈'}),
 music:A('memorySequence','Fraza chóru żab','Zapamiętaj nuty: Do, Mi, Sol, Mi, Fa, Re, Do. Przeczytaj zapis, następnie ukryj go i zagraj frazę na klawiszach. Każdy klawisz może wydać dźwięk, jeśli audio gry jest włączone.',{buttons:['Do','Re','Mi','Fa','Sol'],answer:[0,2,4,2,3,1,0],notes:[261.63,293.66,329.63,349.23,392],prop:'music',symbol:'♫'}),
 'snape-office':A('subset','Odważniki pod nadzorem Snape’a','Zrównoważ porcję sproszkowanego bezoaru o masie 17 jednostek. Każdego odważnika możesz użyć tylko raz. Kliknięcie położonego ciężarka zdejmuje go z szalki.',{weights:[1,2,3,5,8,13],target:17,solution:[0,2,5],prop:'scales',symbol:'⚖'}),
 'hidden-corridor':A('vector','Trzy głowy, jeden spokojny sen','Flet uspokaja lewą głowę o 2, lecz budzi prawą o 1. Harfa uspokaja środkową o 2 i budzi lewą o 1. Mruczenie uspokaja prawą o 2 i budzi środkową o 1. Gdy każda głowa ma najwyżej 2 czujności, zastosuj ciszę. Uśpij wszystkie trzy.',{labels:['Lewa głowa','Środkowa głowa','Prawa głowa'],initial:[4,4,4],target:[0,0,0],min:[0,0,0],max:[6,6,6],buttons:['Flet ♫','Harfa ♬','Mruczenie ♪','Cisza ○'],vectors:[[-2,0,1],[1,-2,0],[0,1,-2],[-1,-1,-1]],quiet:true,solution:[0,1,2,0,1,2,3,3],prop:'threeheads',symbol:'♬'})
};
const defaultProps={history:['chronicle','⌛'],library:['books','▤'],headmaster:['pensieve','◎'],trophy:['trophies','♜']};
for(const [id,a] of Object.entries(ACTIVITIES)){a.id=id;if(!a.prop)[a.prop,a.symbol]=defaultProps[id]||['crystal','✦'];}

export function createActivityState(id){const a=ACTIVITIES[id];if(!a)throw new Error('Unknown room activity: '+id);const s={moves:0,message:'',failed:false,step:0,mistakes:0,revealed:a.kind==='memorySequence',values:[...(a.initial||[])],selected:null,paired:[],opened:[],matched:[],assignments:(a.items||[]).map(()=>-1),pos:a.start,checkpoint:0,gateOpen:false,hp:5,enemyHp:36,energy:3,turn:0,water:[0,0],chosen:[]};
 if(a.kind==='order')s.values=[...a.initial];
 if(a.kind==='sliding'){s.values=[1,2,3,4,5,6,7,8,0];let empty=8;for(const i of a.scramble){[s.values[i],s.values[empty]]=[s.values[empty],s.values[i]];empty=i;}}
 return s;}
const same=(x,y)=>x.length===y.length&&x.every((v,i)=>v===y[i]);
export function isActivityComplete(id,s){const a=ACTIVITIES[id];if(a.equations){const [x,y,z]=s.values;return x>0&&y>0&&z>0&&x+y===7&&y-z===2&&x*z===6;}switch(a.kind){case'sequence':case'memorySequence':case'connect':case'defence':return s.step===a.answer.length;case'dials':case'vector':case'order':case'numbergrid':return same(s.values,a.target);case'lights':return same(s.values,a.target||s.values.map(()=>0));case'grid':return s.pos===a.goal&&s.checkpoint===a.checkpoints.length;case'match':return s.paired.length===a.left.length;case'assign':return s.assignments.every(x=>x>=0)&&(a.target?same(s.assignments,a.target):a.capacities.every((c,i)=>s.assignments.reduce((sum,b,j)=>sum+(b===i?a.weights[j]:0),0)===c));case'duel':return s.enemyHp<=0&&s.hp>0;case'sliding':return same(s.values,[1,2,3,4,5,6,7,8,0]);case'memory':return s.matched.length===a.cards.length;case'jugs':return s.water[0]===a.target;case'subset':return s.chosen.reduce((sum,i)=>sum+a.weights[i],0)===a.target;default:return false;}}
export function stepActivity(id,s,action){const a=ACTIVITIES[id];s.moves++;s.failed=false;s.message='';const index=Number(action.index);const fail=m=>{s.failed=true;s.message=m;};
 if(action.type==='check'){if(!isActivityComplete(id,s))fail(a.kind==='dials'&&a.waterMix?'Sprawdź obie wielkości: 10 miarek oraz 40°.':a.kind==='numbergrid'?'Cyfry lub sumy jeszcze nie pasują. Każda cyfra występuje raz.':'Układ jeszcze nie jest gotowy. Porównaj go z instrukcją i spróbuj ponownie.');return s;}
 switch(a.kind){
  case'sequence':case'connect':case'memorySequence':case'defence':{
   if(action.type==='reveal'){s.revealed=!s.revealed;s.step=0;s.message=s.revealed?'Wzór jest widoczny. Obejrzyj go i ukryj, gdy będziesz gotowy.':'Teraz odtwórz wzór z pamięci.';break;}
   if(a.kind==='memorySequence'&&s.revealed){fail('Najpierw ukryj wzór, aby rozpocząć próbę.');break;}
   if(index===a.answer[s.step]){s.step++;s.message=a.responses?.[s.step-1]||`Poprawnie · ${s.step} / ${a.answer.length}`;}else{if(a.kind==='defence'){s.mistakes++;if(s.mistakes>=3){s.step=0;s.mistakes=0;fail('Trzy trafienia. Osłona odnowiona — zacznij sekwencję od początku.');}else fail('Impuls minął tarczę. Popraw jej stronę. Pomyłki: '+s.mistakes+' / 3.');}else{s.step=0;fail(a.kind==='creatures'?'Zwierzę cofa się. Spróbuj ponownie.':'To nie ten krok. Próba zaczyna się od początku.');}}break;}
  case'dials':{const max=a.maxes?.[index]??a.max,min=a.min??0,value=s.values[index]+Number(action.delta);s.values[index]=a.wrap?(value-min+max-min+1)%(max-min+1)+min:Math.max(min,Math.min(max,value));break;}
  case'vector':{if(a.quiet&&index===3&&s.values.some(x=>x>2)){fail('Jest jeszcze zbyt głośno. Każda głowa musi mieć najwyżej 2 czujności.');break;}const next=s.values.map((x,i)=>x+a.vectors[index][i]);if(next.some((x,i)=>x<a.min[i]||x>a.max[i]))fail('Ten ruch przekroczyłby zakres. Najpierw wyrównaj pozostałe wskaźniki.');else s.values=next;break;}
  case'order':{const to=index+Number(action.delta);if(to>=0&&to<s.values.length)[s.values[index],s.values[to]]=[s.values[to],s.values[index]];break;}
  case'lights':{let cells;if(a.effects)cells=a.effects[index];else if(a.mirror)cells=[index,Math.floor(index/a.size)*a.size+(a.size-1-index%a.size)];else{const x=index%a.size,y=Math.floor(index/a.size);cells=[index];if(x>0)cells.push(index-1);if(x<a.size-1)cells.push(index+1);if(y>0)cells.push(index-a.size);if(y<a.size-1)cells.push(index+a.size);}for(const i of new Set(cells))s.values[i]=s.values[i]?0:1;break;}
  case'numbergrid':if(!a.initial[index])s.values[index]=Math.max(0,Math.min(9,Number(action.value)||0));break;
  case'grid':{let next;if(a.knight){next=index;const dx=Math.abs(next%a.size-s.pos%a.size),dy=Math.abs(Math.floor(next/a.size)-Math.floor(s.pos/a.size));if(!((dx===1&&dy===2)||(dx===2&&dy===1))){fail('Skoczek porusza się dwa pola w jednym kierunku i jedno w drugim.');break;}}else{const d={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[action.direction];if(!d)break;const x=s.pos%a.size+d[0]*(a.jump||1),y=Math.floor(s.pos/a.size)+d[1]*(a.jump||1);if(x<0||x>=a.size||y<0||y>=a.size){fail('Tu kończy się plansza.');break;}next=y*a.size+x;}if(a.blocked.includes(next)||next===a.gate&&!s.gateOpen){fail(next===a.gate?'Most jest zamknięty. Najpierw dotrzyj do dźwigni.':'To pole jest zablokowane. Poszukaj innej drogi.');break;}const checkpointIndex=a.checkpoints.indexOf(next);if(checkpointIndex>s.checkpoint){fail('Najpierw odwiedź znacznik '+(s.checkpoint+1)+'.');break;}s.pos=next;if(next===a.switchCell){s.gateOpen=true;s.message='Dźwignia otwiera środkowy most.';}if(checkpointIndex===s.checkpoint){s.checkpoint++;s.message='Znacznik '+s.checkpoint+' / '+a.checkpoints.length+' odwiedzony.';}if(next===a.goal&&s.checkpoint<a.checkpoints.length)fail('Przed metą trzeba odwiedzić wszystkie znaczniki.');break;}
  case'match':if(action.side==='left')s.selected=index;else if(s.selected===null)fail('Najpierw wybierz pieczęć po lewej.');else if(index===s.selected){if(!s.paired.includes(index))s.paired.push(index);s.selected=null;s.message='Pieczęć otwarta.';}else{s.selected=null;fail('Ta ochrona nie odpowiada pieczęci. Wybierz nową parę.');}break;
  case'assign':if(action.type==='item')s.selected=index;else if(s.selected===null)fail('Najpierw wybierz przedmiot.');else{s.assignments[s.selected]=index;s.selected=null;}break;
  case'duel':{const phase=s.turn%3;if(action.type==='attack'){if(s.energy<1){fail('Brakuje skupienia. Użyj osłony lub skupienia.');break;}s.energy--;if(phase===1)s.message='Echo osłania się. Czar odbija się od tarczy.';else{s.enemyHp-=12;s.message='Trafienie · −12 wytrzymałości echa.';}}else if(action.type==='guard'){s.energy=Math.min(5,s.energy+1);s.message='Tarcza gotowa. Odzyskujesz 1 skupienie.';}else{s.energy=Math.min(5,s.energy+2);s.message='Odzyskujesz 2 skupienia.';}if(s.enemyHp>0&&phase===0&&action.type!=='guard'){s.hp--;s.message+=' Echo trafia: −1 wytrzymałości.';}s.turn++;if(s.hp<=0){fail('Echo wygrywa tę próbę. Użyj „Zacznij ponownie”, aby spróbować innej taktyki.');}break;}
  case'sliding':{const empty=s.values.indexOf(0),distance=Math.abs(index%3-empty%3)+Math.abs(Math.floor(index/3)-Math.floor(empty/3));if(distance!==1)fail('Możesz przesunąć tylko fragment obok pustego pola.');else[s.values[index],s.values[empty]]=[s.values[empty],s.values[index]];break;}
  case'memory':{if(s.matched.includes(index)||s.opened.includes(index))break;if(s.opened.length===2)s.opened=[];s.opened.push(index);if(s.opened.length===2){if(a.cards[s.opened[0]]===a.cards[s.opened[1]]){s.matched.push(...s.opened);s.opened=[];s.message='Wspomnienia łączą się w srebrzystą nić.';}else fail('To różne wspomnienia. Następny wybór zakryje tę parę.');}break;}
  case'jugs':{if(action.type.startsWith('fill'))s.water[Number(action.type.at(-1))]=a.sizes[Number(action.type.at(-1))];else if(action.type.startsWith('empty'))s.water[Number(action.type.at(-1))]=0;else{const from=Number(action.type[4]),to=1-from,amount=Math.min(s.water[from],a.sizes[to]-s.water[to]);s.water[from]-=amount;s.water[to]+=amount;}break;}
  case'subset':{const p=s.chosen.indexOf(index);if(p<0)s.chosen.push(index);else s.chosen.splice(p,1);break;}
 }return s;}

// The session owns completion and disposal; the host owns persistent rewards.
const checkKinds=new Set(['dials','order','numbergrid','assign','subset']);
export function createActivitySession(id,{complete=()=>{}}={}){
 let current=createActivityState(id),disposed=false,awarded=false;
 return {
  getState:()=>current,
  dispatch(action){
   if(disposed||current.done||current.hp<=0)return current;
   stepActivity(id,current,action);
   if(isActivityComplete(id,current)&&(!checkKinds.has(ACTIVITIES[id].kind)||action.type==='check')){
    current.done=true;current.failed=false;current.message='Ćwiczenie ukończone. Dobra robota!';
    if(!awarded){awarded=true;complete(id);}
   }
   return current;
  },
  reset(){if(!disposed)current=createActivityState(id);return current;},
  dispose(){disposed=true;}
 };
}

export function openRoomActivity(id,{panel,state={},complete=()=>{},toast=()=>{},audio}={}){
 const a=ACTIVITIES[id];if(!a||!panel)throw new Error('Room activity requires a known room and a panel element.');
 const doc=panel.ownerDocument,previouslyDone=state.roomsCompleted?.includes(id);let disposed=false;
 const session=createActivitySession(id,{complete(room){complete(room);audio?.note?.(660,.3,'sine',.04);toast(previouslyDone?'Ćwiczenie powtórzone.':'Nowe ćwiczenie zapisane w dzienniku.');}});
 const el=(tag,className,text)=>{const n=doc.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;};
 const button=(text,action,className='activity-action',disabled=false)=>{const b=el('button',className,text);b.type='button';b.disabled=disabled;b.dataset.action=JSON.stringify(action);b.dataset.focus=JSON.stringify(action);return b;};
 function render(){
  if(disposed)return;const s=session.getState(),root=el('section','room-activity');
  const head=el('div','activity-header');head.append(el('span','activity-symbol',a.symbol),el('h2','',a.title));root.append(head,el('p','activity-instructions',a.instructions));
  root.append(el('p','activity-progress',`${previouslyDone?'Zaliczone wcześniej · powtórka':'Próba praktyczna'} · Ruchy: ${s.moves}`));
  const board=el('div','activity-board'),controls=el('div','activity-controls');
  const cells=(values,columns,make)=>{const g=el('div','activity-grid');g.style.setProperty('--columns',String(columns));values.forEach((v,i)=>g.append(make(v,i)));return g;};
  const metric=(label,value)=>{const row=el('div','activity-metric');row.append(el('span','',label),el('strong','',value));return row;};
  const meter=(label,value,max)=>{const row=metric(label,String(value));const m=el('meter');m.min=0;m.max=max;m.value=value;m.setAttribute('aria-label',label);row.append(m);return row;};
  switch(a.kind){
   case'dials':{
    const list=el('div','activity-dials');a.labels.forEach((label,i)=>{const row=el('div','activity-dial'),out=el('output','',a.options?.[i]?.[s.values[i]]??`${s.values[i]}${a.unit?' '+a.unit:''}`);row.append(el('span','',label),button('−',{index:i,delta:-1},'activity-action',s.done),out,button('+',{index:i,delta:1},'activity-action',s.done));row.children[1].setAttribute('aria-label',`Zmniejsz: ${label}`);row.children[3].setAttribute('aria-label',`Zwiększ: ${label}`);list.append(row);});board.append(list);
    if(a.waterMix){const [hot,cold]=s.values,total=hot+cold;board.append(metric('Objętość',`${total} / 10 miarek`),metric('Temperatura',total?`${((70*hot+20*cold)/total).toFixed(1)}° / 40°`:'Pusta wanna'));}
    if(a.equations){const [x,y,z]=s.values;board.append(metric('A + B = 7',`${x+y}`),metric('B − C = 2',`${y-z}`),metric('A × C = 6',`${x*z}`));}
    break;
   }
   case'vector':{const metrics=el('div','activity-metrics');a.labels.forEach((label,i)=>metrics.append(metric(label,`${s.values[i]} / cel ${a.target[i]}`)));board.append(metrics);a.buttons.forEach((label,i)=>controls.append(button(label,{index:i},'activity-action',s.done)));break;}
   case'sequence':case'memorySequence':case'defence':case'connect':{
    if(a.kind==='memorySequence'){board.append(el('p','activity-pattern',s.revealed?a.answer.map(i=>a.buttons[i]).join(' → '):'Wzór ukryty — odtwórz go z pamięci.'));controls.append(button(s.revealed?'Ukryj wzór i zacznij':'Pokaż wzór ponownie',{type:'reveal'},'activity-action',s.done));}
    if(a.kind==='defence')board.append(metric('Nadchodzący impuls',s.done?'Wszystkie odbite':a.buttons[a.answer[s.step]].replace('tarcza','strona')),metric('Trafienia',`${s.mistakes} / 3`));
    board.append(metric('Postęp',`${s.step} / ${a.answer.length}`));
    if(a.kind==='connect'){
     const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('class','activity-star-map');svg.setAttribute('aria-label','Połączone gwiazdy');
     for(let n=1;n<s.step;n++){const p=a.points[a.answer[n-1]],q=a.points[a.answer[n]],line=doc.createElementNS(svg.namespaceURI,'line');for(const [key,v]of Object.entries({x1:p[0],y1:p[1],x2:q[0],y2:q[1],stroke:'#e2ca8c','stroke-width':1}))line.setAttribute(key,String(v));svg.append(line);}
     a.points.forEach((p,i)=>{const circle=doc.createElementNS(svg.namespaceURI,'circle');circle.setAttribute('cx',p[0]);circle.setAttribute('cy',p[1]);circle.setAttribute('r','2.2');circle.setAttribute('fill',a.answer.slice(0,s.step).includes(i)?'#f8df9c':'#758da7');svg.append(circle);const label=doc.createElementNS(svg.namespaceURI,'text');label.setAttribute('x',p[0]+3);label.setAttribute('y',p[1]+1);label.setAttribute('fill','#dce4eb');label.setAttribute('font-size','4');label.textContent=a.buttons[i].split(' ·')[0];svg.append(label);});board.append(svg);
    }
    a.buttons.forEach((label,i)=>controls.append(button(label,{index:i},'activity-action',s.done||(a.kind==='memorySequence'&&s.revealed))));break;
   }
   case'order':{
    const list=el('div','activity-order');s.values.forEach((v,i)=>{const row=el('div','activity-order-row');row.append(el('span','',`${i+1}. ${a.items[v]}`),button('↑',{index:i,delta:-1},'activity-action',s.done||i===0),button('↓',{index:i,delta:1},'activity-action',s.done||i===s.values.length-1));row.children[1].setAttribute('aria-label',`Przesuń wyżej: ${a.items[v]}`);row.children[2].setAttribute('aria-label',`Przesuń niżej: ${a.items[v]}`);list.append(row);});board.append(list);break;
   }
   case'lights':{
    board.append(cells(s.values,a.size,(v,i)=>{const b=button(`${v?'●':'○'} ${i+1}`,{index:i},'activity-cell'+(v?' active':''),s.done||Boolean(a.effects));b.setAttribute('aria-label',`Pole ${i+1}: ${v?'zapalone':'zgaszone'}`);return b;}));if(a.effects)a.labels.forEach((label,i)=>controls.append(button(label,{index:i},'activity-action',s.done)));break;
   }
   case'numbergrid':{
    board.append(cells(s.values,a.size,(v,i)=>{if(a.initial[i])return el('div','activity-cell fixed',String(v));const input=el('input','activity-cell');input.type='number';input.min='1';input.max='9';input.step='1';input.inputMode='numeric';input.value=v||'';input.disabled=Boolean(s.done);input.dataset.cell=String(i);input.dataset.focus='cell'+i;input.setAttribute('aria-label',`Wiersz ${Math.floor(i/3)+1}, kolumna ${i%3+1}`);return input;}));
    const sums=el('div','activity-metrics');for(let i=0;i<3;i++){sums.append(metric(`Wiersz ${i+1}`,String(s.values.slice(i*3,i*3+3).reduce((x,y)=>x+y,0))),metric(`Kolumna ${i+1}`,String(s.values[i]+s.values[i+3]+s.values[i+6])));}board.append(sums);break;
   }
   case'grid':{
    board.append(cells(Array.from({length:a.size*a.size},(_,i)=>i),a.size,(_,i)=>{const cp=a.checkpoints.indexOf(i),blocked=a.blocked.includes(i)||(i===a.gate&&!s.gateOpen),text=i===s.pos?'●':blocked?'×':i===a.goal?'★':i===a.switchCell?'⚙':cp>=0?String(cp+1):'·';const b=button(text,{index:i},'activity-cell'+(i===s.pos?' current':'')+(blocked?' blocked':'')+(i===a.goal?' goal':'')+(cp>=0&&cp<s.checkpoint?' matched':''),s.done||!a.knight||blocked);b.setAttribute('aria-label',`Pole ${Math.floor(i/a.size)+1},${i%a.size+1}: ${i===s.pos?'Twoja pozycja':blocked?'blokada':i===a.goal?'meta':cp>=0?'znacznik '+(cp+1):i===a.switchCell?'dźwignia':'wolne'}`);return b;}));
    board.append(metric('Znaczniki',`${s.checkpoint} / ${a.checkpoints.length}`));if(!a.knight)for(const [direction,label]of [['left','← W lewo'],['up','↑ W górę'],['down','↓ W dół'],['right','→ W prawo']])controls.append(button(label,{direction},'activity-action',s.done));break;
   }
   case'match':{
    const columns=el('div','activity-columns');for(const side of ['left','right']){const col=el('div','activity-choices');(side==='left'?a.left.map((_,i)=>i):a.rightOrder).forEach(i=>{const b=button(a[side][i],{side,index:i},'activity-action'+(s.paired.includes(i)?' matched':'')+(side==='left'&&s.selected===i?' selected':''),s.done||s.paired.includes(i));b.setAttribute('aria-pressed',String(s.paired.includes(i)||(side==='left'&&s.selected===i)));col.append(b);});columns.append(col);}board.append(columns);break;
   }
   case'assign':{
    const columns=el('div','activity-columns'),items=el('div','activity-choices'),bins=el('div','activity-choices');a.items.forEach((label,i)=>{const b=button(`${label}${s.assignments[i]>=0?' → '+a.bins[s.assignments[i]]:''}`,{type:'item',index:i},'activity-action'+(s.selected===i?' selected':''),s.done);b.setAttribute('aria-pressed',String(s.selected===i));items.append(b);});a.bins.forEach((label,i)=>{const weight=a.weights?s.assignments.reduce((total,b,j)=>total+(b===i?a.weights[j]:0),0):null;bins.append(button(`${label}${weight!==null?' · ładunek '+weight:''}`,{type:'bin',index:i},'activity-action',s.done));});columns.append(items,bins);board.append(columns);break;
   }
   case'duel':{
    board.append(meter('Twoja wytrzymałość',s.hp,5),meter('Echo',Math.max(0,s.enemyHp),36),meter('Skupienie',s.energy,5),metric('Echo teraz',s.done?'Uspokojone':['Atak — użyj osłony','Tarcza — odzyskaj skupienie','Zbiera moc — atakuj'][s.turn%3]));for(const [type,label]of [['guard','Protego · osłona'],['focus','Odzyskaj skupienie'],['attack','Expelliarmus · atak']])controls.append(button(label,{type},'activity-action',s.done||s.hp<=0));break;
   }
   case'sliding':board.append(cells(s.values,3,(v,i)=>button(v?String(v):'·',{index:i},'activity-cell'+(!v?' empty':''),s.done||!v)));break;
   case'memory':board.append(cells(a.cards,4,(v,i)=>{const show=s.opened.includes(i)||s.matched.includes(i),b=button(show?v:'?',{index:i},'activity-cell'+(s.matched.includes(i)?' matched':'')+(s.opened.includes(i)?' active':''),s.done||s.matched.includes(i));b.setAttribute('aria-label',`Karta ${i+1}: ${show?a.names[v]:'zakryta'}`);return b;}));break;
   case'jugs':{
    board.append(meter('Duży dzban',s.water[0],5),meter('Mały dzban',s.water[1],3));for(const [type,label]of [['fill0','Napełnij duży'],['empty0','Opróżnij duży'],['fill1','Napełnij mały'],['empty1','Opróżnij mały'],['pour01','Przelej duży → mały'],['pour10','Przelej mały → duży']])controls.append(button(label,{type},'activity-action',s.done));break;
   }
   case'subset':board.append(metric('Masa odważników',`${s.chosen.reduce((sum,i)=>sum+a.weights[i],0)} / ${a.target}`));a.weights.forEach((v,i)=>{const b=button(`${s.chosen.includes(i)?'✓ ':''}${v}`,{index:i},'activity-action'+(s.chosen.includes(i)?' selected':''),s.done);b.setAttribute('aria-pressed',String(s.chosen.includes(i)));controls.append(b);});break;
  }
  root.append(board,controls);
  const feedback=el('p','activity-feedback'+(s.failed?' error':'')+(s.done?' success':''),s.message||'Przygotuj stanowisko i wykonaj instrukcję.');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');root.append(feedback);
  const footer=el('div','activity-footer');if(checkKinds.has(a.kind))footer.append(button('Sprawdź wynik',{type:'check'},'primary',s.done));footer.append(button(s.done?'Powtórz bez dodatkowej nagrody':'Zacznij ponownie',{type:'reset'},'activity-action'));root.append(footer);panel.replaceChildren(root);
 }
 function handleClick(event){const node=event.target.closest?.('button[data-action]');if(!node||!panel.contains(node)||disposed)return;const action=JSON.parse(node.dataset.action),focus=node.dataset.focus;if(action.type==='reset')session.reset();else{session.dispatch(action);if(a.notes&&Number.isInteger(action.index))audio?.note?.(a.notes[action.index],.2,'sine',.04);}render();for(const b of panel.querySelectorAll('[data-focus]'))if(b.dataset.focus===focus&&!b.disabled){b.focus({preventScroll:true});break;}}
 function handleChange(event){const input=event.target;if(disposed||!input.matches?.('input[data-cell]'))return;const focus=input.dataset.focus;session.dispatch({index:Number(input.dataset.cell),value:input.value});render();for(const n of panel.querySelectorAll('[data-focus]'))if(n.dataset.focus===focus&&!n.disabled){n.focus({preventScroll:true});break;}}
 panel.addEventListener('click',handleClick);panel.addEventListener('change',handleChange);render();
 return {getState:session.getState,reset(){session.reset();render();},dispose(){if(disposed)return;disposed=true;session.dispose();panel.removeEventListener('click',handleClick);panel.removeEventListener('change',handleChange);}};
}

// Small physical exercise stations. All coordinates are relative to this table;
// the group is positioned clear of the entrance and central walking corridor.
export function createRoomActivityProps(id,T){
 const a=ACTIVITIES[id];if(!a)throw new Error('Unknown room activity: '+id);
 const group=new T.Group();group.name='activity-'+id;group.position.set(10.2,0,11.3);
 const materials=new Set(),geometries=new Set();let disposed=false;
 const mat=(color,metalness=0,roughness=.65,emissive=0)=>{const m=new T.MeshStandardMaterial({color,metalness,roughness,emissive,emissiveIntensity:.5});materials.add(m);return m;};
 const wood=mat(0x37271f),metal=mat(0xb99b60,.75,.3),dark=mat(0x1d2834,.1),paper=mat(0xc7b58e),glow=mat(0x9cbedd,.15,.3,0x4c6c9f),green=mat(0x547558),white=mat(0xc6c8bf);
 const add=(geometry,material,x=0,y=0,z=0)=>{geometries.add(geometry);const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;};
 const box=(w,h,d,m,x=0,y=0,z=0)=>add(new T.BoxGeometry(w,h,d),m,x,y,z);
 const ball=(r,m,x=0,y=0,z=0)=>add(new T.SphereGeometry(r,12,8),m,x,y,z);
 const cyl=(r,h,m,x=0,y=0,z=0,top=r)=>add(new T.CylinderGeometry(top,r,h,14),m,x,y,z);
 const ring=(r,m,x=0,y=0,z=0)=>add(new T.TorusGeometry(r,.035,6,24),m,x,y,z);
 box(1.65,.12,1.2,wood,0,1.02);for(const x of [-.63,.63])for(const z of [-.43,.43])box(.1,1,.1,wood,x,.5,z);
 box(1.15,.012,.65,paper,0,1.09);const floaters=[];
 function book(x=0,z=0,color=dark){box(.48,.1,.36,color,x,1.17,z);box(.43,.075,.32,paper,x,1.18,z);}
 function cup(x=0,z=0){cyl(.15,.24,white,x,1.25,z,.19);ring(.1,metal,x+.19,1.27,z);}
 function plant(x=0,z=0){cyl(.16,.25,wood,x,1.21,z,.21);for(let n=0;n<3;n++){const leaf=ball(.15,green,x+Math.cos(n*2.1)*.1,1.48+n*.05,z+Math.sin(n*2.1)*.08);leaf.scale.set(.6,1.5,.4);}}
 function scale(){box(.75,.06,.2,metal,0,1.19);cyl(.035,.55,metal,0,1.47);box(.9,.035,.035,metal,0,1.74);for(const x of [-.37,.37]){cyl(.012,.2,metal,x,1.63);const r=ring(.18,metal,x,1.5);r.rotation.x=Math.PI/2;}}
 switch(a.prop){
  case'candles':for(let i=0;i<4;i++){cyl(.045,.26,white,(i-1.5)*.27,1.26,0);const f=ball(.05,glow,(i-1.5)*.27,1.43);f.scale.y=1.6;floaters.push(f);}break;
  case'needle':{const n=cyl(.014,.7,metal,0,1.38);n.rotation.z=.55;ring(.04,metal,.18,1.69);break;}
  case'feather':{const f=ball(.22,white,0,1.6);f.scale.set(.35,1.6,.12);f.rotation.z=-.35;floaters.push(f);break;}
  case'cauldron':{ball(.3,dark,0,1.4);const lip=ring(.27,metal,0,1.56);lip.rotation.x=Math.PI/2;const liquid=cyl(.23,.02,green,0,1.57);floaters.push(ball(.045,glow,-.1,1.8));break;}
  case'shield':case'duel':{const s=ball(.36,metal,0,1.48);s.scale.set(.8,1,.18);box(.055,.4,.06,glow,0,1.48,.07);box(.3,.055,.06,glow,0,1.48,.07);break;}
  case'plants':case'food':plant(-.36);plant(.32);break;
  case'teacup':case'brokenCup':cup();if(a.prop==='brokenCup')box(.1,.08,.08,white,.3,1.15,.2);break;
  case'orrery':{ball(.13,metal,0,1.6);for(let i=0;i<2;i++){const r=ring(.32+i*.1,metal,0,1.6);r.rotation.x=.5+i*.8;r.rotation.y=i*.6;}floaters.push(ball(.07,glow,.35,1.6,0));break;}
  case'runestone':case'numbercube':{const c=box(.48,.5,.35,dark,0,1.38);c.rotation.y=.2;for(let i=0;i<3;i++){const r=box(.025,.2,.02,glow,(i-1)*.1,1.4,.22);r.rotation.z=(i-1)*.4;}break;}
  case'circuit':for(let i=0;i<4;i++){cyl(.06,.08,metal,(i-1.5)*.28,1.17);ball(.07,glow,(i-1.5)*.28,1.27);}box(1,.015,.025,metal,0,1.13);break;
  case'hippogriff':case'owls':case'eagle':{ball(.2,dark,0,1.38);ball(.13,white,0,1.65);for(const x of [-.25,.25]){const wing=ball(.2,white,x,1.45);wing.scale.set(1.6,.4,.3);wing.rotation.z=x>0?.3:-.3;}const beak=add(new T.ConeGeometry(.05,.13,8),metal,0,1.65,.14);beak.rotation.x=Math.PI/2;break;}
  case'broom':{const shaft=cyl(.024,1,wood,0,1.4);shaft.rotation.z=1.2;const brush=add(new T.ConeGeometry(.17,.35,10),paper,.48,1.2);brush.rotation.z=1.2;break;}
  case'balance':case'scales':scale();ball(.07,glow,-.37,1.54);break;
  case'portals':for(const x of [-.32,.32])ring(.25,glow,x,1.4);break;
  case'books':case'chronicle':case'sealedbook':book(-.25);book(.28,.12);if(a.prop==='sealedbook')box(.06,.15,.42,metal,-.25,1.21);break;
  case'chess':{box(.8,.03,.8,dark,0,1.13);cyl(.14,.08,metal,0,1.2);cyl(.08,.35,metal,0,1.4);const head=ball(.12,metal,.08,1.61);head.scale.set(1.3,.8,.6);break;}
  case'snake':case'serpentdoor':{const r=ring(.3,green,0,1.45);r.rotation.z=.4;ball(.12,green,.25,1.6,.03);break;}
  case'barrels':for(const x of [-.4,0,.4]){cyl(.14,.36,wood,x,1.3);for(const y of [1.2,1.4]){const r=ring(.145,metal,x,y);r.rotation.x=Math.PI/2;}}break;
  case'pensieve':{cyl(.32,.16,metal,0,1.23,.4);cyl(.35,.015,glow,0,1.32);floaters.push(ball(.07,glow,0,1.6));break;}
  case'bandages':for(const x of [-.3,.3]){const r=cyl(.14,.3,white,x,1.25);r.rotation.z=Math.PI/2;}break;
  case'taps':case'jugs':for(const x of [-.32,.32]){cyl(.14,.35,metal,x,1.3,.19);ring(.12,metal,x+.18,1.37);}break;
  case'mirror':{const m=ball(.4,metal,0,1.55);m.scale.set(.7,1,.1);const r=ring(.4,dark,0,1.55);r.scale.x=.7;break;}
  case'changingroom':box(.28,.35,.3,wood,-.4,1.3);book(.3);ring(.2,metal,0,1.5);break;
  case'stairs':for(let i=0;i<4;i++)box(.32,.1*(i+1),.55,dark,(i-1.5)*.3,1.15+.05*i);break;
  case'luggage':for(const x of [-.35,.35]){box(.5,.3,.35,wood,x,1.28);box(.04,.32,.37,metal,x,1.28);}break;
  case'trophies':{cyl(.22,.05,metal,0,1.17);cyl(.045,.25,metal,0,1.3);cyl(.12,.25,metal,0,1.54,.25);for(const x of [-.25,.25])ring(.12,metal,x,1.58);break;}
  case'stag':{ball(.19,glow,0,1.37);ball(.09,glow,0,1.59);for(const x of [-.12,.12]){const antler=cyl(.02,.24,metal,x,1.76);antler.rotation.z=x*3;}break;}
  case'music':{box(.95,.1,.4,dark,0,1.19);for(let i=0;i<5;i++)box(.15,.025,.3,white,(i-2)*.18,1.255,.04);break;}
  case'threeheads':for(const x of [-.32,0,.32]){ball(.15,dark,x,1.43);const snout=ball(.09,wood,x,1.39,.13);snout.scale.set(.8,.6,1.3);}break;
  default:floaters.push(add(new T.OctahedronGeometry(.25),glow,0,1.5));
 }
 const bases=floaters.map(m=>m.position.y);
 return {group,update(time){if(disposed)return;for(let i=0;i<floaters.length;i++)floaters[i].position.y=bases[i]+Math.sin(time*1.5+i)*.035;},dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();group.clear();}};
}

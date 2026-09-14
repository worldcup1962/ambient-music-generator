import pathlib,json,urllib.request,urllib.parse,io,tarfile,re,hashlib
import soundfile as sf
import numpy as np
ROOT=pathlib.Path(__file__).resolve().parents[1]; OUT=ROOT/'assets/acoustic'; manifest=json.loads((OUT/'manifest.json').read_text())
BASE='https://raw.githubusercontent.com/sgossner/VSCO-2-CE/440300901dfe9275fd84e0b7763af1f8443ae62e/'
def get(url):
 return urllib.request.urlopen(url,timeout=60).read()
def save(family,raw,midi,source,tag,tune=0,page=None,measure=False):
 data,rate=sf.read(io.BytesIO(raw),always_2d=True); peak=float(np.max(abs(data)))
 active=np.where(np.max(abs(data),axis=1)>peak*.008)[0]; start=max(0,int(active[0])-int(rate*.02)); data=data[start:]
 end=np.where(np.max(abs(data),axis=1)>max(peak*.001,.00002))[0]
 if len(end): data=data[:min(len(data),int(end[-1])+int(rate*.3))]
 if measure:
  x=data[int(.2*rate):int(2.2*rate)].mean(1); spectrum=abs(np.fft.rfft(x*np.hanning(len(x)))); freq=np.fft.rfftfreq(len(x),1/rate)[np.argmax(spectrum)]; measured=69+12*np.log2(freq/440); midi=round(measured); tune=(midi-measured)*100; print(tag,'measured',round(freq,2),'Hz',midi,flush=True)
 tail=min(len(data),int(rate*.03)); data[-tail:]*=np.linspace(1,0,tail)[:,None]; data*=.75/max(peak,.001)
 name=f'{family}_{midi}_{hashlib.sha256(tag.encode()).hexdigest()[:6]}'; target=OUT/(name+'.flac'); sf.write(target,data,rate,subtype='PCM_16')
 return {'name':name,'midi':midi,'tune':round(tune,2),'url':f'./assets/acoustic/{name}.flac','source':source,'sourcePage':page or source,'sourceSha256':hashlib.sha256(raw).hexdigest(),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'duration':round(len(data)/rate,3),'trimStart':round(start/rate,4)}
# 元SFZはフルートをC4=72と定義。名前だけから推測した値を使わない。
for entry in manifest['flute']:
 name=entry['source'].split('/')[-1]; note=re.search(r'_([A-G]\d)_',name).group(1); entry['midi']={'C3':60,'A3':69,'C4':72,'E4':76,'A4':81,'C5':84,'E5':88,'C6':96}[note]
for note,midi in [('C3',60),('A3',69),('E4',76)]:
 path=f'Woodwinds/Flute/expvib/LDFlute_expvib_{note}_v1_1.wav'; url=BASE+urllib.parse.quote(path)
 manifest['flute']=[entry for entry in manifest['flute'] if entry['source']!=url]; manifest['flute'].append(save('flute',get(url),midi,url,path))
manifest.pop('marimba',None)
manifest['kalimba']=[]
archive=ROOT/'assets/kalimba-source.tar.xz'
with tarfile.open(archive) as tar:
 for group,midi,tune in [('1',60,25),('2',63,5),('3',64,-40),('4',67,7),('5',68,17),('6',72,22),('7',73,-15)]:
  for rr in [1,2]:
   member=f'Kalimba-SFZ-20190723/samples/{group}_{rr:02}.wav'; raw=tar.extractfile(member).read()
   manifest['kalimba'].append(save('kalimba',raw,midi,'https://freepats.zenvoid.org/Ethnic/Kalimba/Kalimba-SFZ-20190723.tar.xz',member,tune,page='https://freepats.zenvoid.org/Ethnic/kalimba.html'))
manifest['epiano']=[]
rhodes='https://raw.githubusercontent.com/sfzinstruments/jlearman.jRhodes3d/aea5b8d3e11e2f7102593789a4e0a0e41b30271a/'
for midi,note in [(45,'A2'),(50,'D3'),(55,'G3'),(59,'B3'),(62,'D4'),(65,'F4'),(71,'B4'),(76,'E5')]:
 path=f'jRhodes3d-mono/A_{midi:03}__{note}_1.flac'; url=rhodes+path
 manifest['epiano'].append(save('epiano',get(url),midi,url,path,page='https://github.com/sfzinstruments/jlearman.jRhodes3d'))
# 収録者が記載する最低共鳴182Hzを基準とし、ボウルの非整数倍音は保つ。
manifest['bowl'][0]['tune']=round(1200*np.log2((440*2**((54-69)/12))/182),2)
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
(ROOT/'acoustic-bank.js').write_text('const acousticBanks = '+json.dumps({key:[{k:e[k] for k in ['name','midi','url','duration'] }|{'tune':e.get('tune',0)} for e in entries] for key,entries in manifest.items()},indent=2)+';\n',encoding='utf8')
print({key:len(value) for key,value in manifest.items()},flush=True)

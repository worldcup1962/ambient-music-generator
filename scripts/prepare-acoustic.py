import concurrent.futures, hashlib, io, json, pathlib, urllib.request
import numpy as np
import soundfile as sf
ROOT=pathlib.Path(__file__).resolve().parents[1]
REV='440300901dfe9275fd84e0b7763af1f8443ae62e'
BASE=f'https://raw.githubusercontent.com/sgossner/VSCO-2-CE/{REV}/'

def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent':'AmbientMusicGenerator'}), timeout=60) as response: return response.read()

def build():
    tree=json.loads(get(f'https://api.github.com/repos/sgossner/VSCO-2-CE/git/trees/{REV}?recursive=1'))
    paths={entry['path'] for entry in tree['tree']}
    jobs=[]
    def add(family, path, midi):
        assert path in paths, path
        jobs.append((family,path,midi,BASE+urllib.parse.quote(path)))
    for note,midi in [('C3',48),('G3',55),('C4',60),('G4',67),('C5',72),('G5',79)]:
        for rr in [1,2]: add('piano',f'Keys/Upright Nr1/UR1_{note}_pp_RR{rr}.wav',midi)
    for note,midi in [('G3',55),('C4',60),('G4',67),('A4',69),('C5',72),('E5',76),('C6',84)]:
        add('strings',f'Strings/Solo Violin/Arco Vib/LLVln_ArcoVib_{note}_p.wav',midi)
    for note,midi in [('C4',60),('A4',69),('C5',72),('E5',76),('C6',84)]:
        add('flute',f'Woodwinds/Flute/expvib/LDFlute_expvib_{note}_v1_1.wav',midi)
    for note,midi in [('C3',48),('G3',55),('D4',62),('F4',65),('A4',69),('C5',72),('G5',79),('D6',86)]:
        add('harp',f'Strings/Harp/KSHarp_{note}_mf.wav',midi)
    jobs.append(('bowl','411486_2154914-hq.mp3',54,'https://cdn.freesound.org/previews/411/411486_2154914-hq.mp3'))
    def process(job):
        family,path,midi,url=job
        raw=get(url); data,rate=sf.read(io.BytesIO(raw),always_2d=True)
        peak=float(np.max(np.abs(data)))
        active=np.where(np.max(np.abs(data),axis=1)>max(peak*.008,.0001))[0]
        start=max(0,int(active[0])-int(rate*.02)) if len(active) else 0
        data=data[start:]
        # 録音の減衰を保ち、無音の末尾だけを除く。
        end=np.where(np.max(np.abs(data),axis=1)>max(peak*.001,.00002))[0]
        if len(end): data=data[:min(len(data),int(end[-1])+int(rate*.3))]
        tail=min(len(data),int(rate*.03)); data[-tail:]*=np.linspace(1,0,tail)[:,None]
        data*=.75/max(peak,.001)
        name=f'{family}_{midi}_{hashlib.sha256(path.encode()).hexdigest()[:6]}'
        target=ROOT/'assets/acoustic'/f'{name}.flac'; sf.write(target,data,rate,subtype='PCM_16')
        entry={'name':name,'midi':midi,'url':f'./assets/acoustic/{name}.flac','source':url,'sourceSha256':hashlib.sha256(raw).hexdigest(),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'duration':round(len(data)/rate,3),'trimStart':round(start/rate,4)}
        # 主なスペクトル成分を点検用に出す。倍音を基音と混同して自動補正しない。
        mono=data[:min(len(data),rate*2)].mean(axis=1); spectrum=abs(np.fft.rfft(mono*np.hanning(len(mono)))); freqs=np.fft.rfftfreq(len(mono),1/rate)
        print(f'{family} {midi}: {entry["duration"]}s peak {freqs[np.argmax(spectrum)]:.1f}Hz',flush=True)
        return family,entry
    banks={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for family,entry in pool.map(process,jobs): banks.setdefault(family,[]).append(entry)
    (ROOT/'assets/acoustic/manifest.json').write_text(json.dumps(banks,ensure_ascii=False,indent=2),encoding='utf8')
if __name__=='__main__': build()

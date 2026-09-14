# 音源のライセンスと出典

音源ごとに利用条件が異なります。特にRhodes録音を含むアプリの再配布は非商用に限られます。

## 2026-09-14 実録音への置き換え

現在の楽器再生は `acoustic/` の録音を使用します。従来の短いアタック音と合成波形の組み合わせから、録音の減衰・息・弓の揺れを残す方式に変更しました。マリンバは削除しました。

| 楽器 | 録音・作者 | 条件 |
| --- | --- | --- |
| ピアノ、ヴァイオリン、フルート、ハープ | [Versilian Studios, VSCO 2 CE](https://github.com/sgossner/VSCO-2-CE/tree/440300901dfe9275fd84e0b7763af1f8443ae62e) | CC0 1.0 |
| カリンバ | [FreePats Kalimba](https://freepats.zenvoid.org/Ethnic/kalimba.html), Xavimart (Javier), Gonzalo, Roberto | CC0 1.0 |
| シンギングボウル | [s-light, Freesound 411486](https://freesound.org/people/s-light/sounds/411486/) | CC0 1.0 |
| エレクトリックピアノ | [Jeffrey Learman, jRhodes3d](https://github.com/sfzinstruments/jlearman.jRhodes3d/tree/aea5b8d3e11e2f7102593789a4e0a0e41b30271a), 実機Rhodes | [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) |

Rhodesは作者クレジットの表示が必要で、サンプルをアプリやソフト音源に含めた商用配布には作者の別途許諾が必要です。一方、演奏して作る楽曲は商用利用も認めると作者が明示しています。原文は [jRhodes-LICENSE.txt](./jRhodes-LICENSE.txt) に保存しています。

加工は先頭・末尾の無音短縮、ピーク音量調整、末尾30msのフェード、16bit FLAC化です。ボウルのみ元データがHQ MP3プレビューであり、FLAC化しても失われた情報は復元されません。カリンバは元SFZの調律値を継承しています。元URL・SHA256・加工後SHA256・音程・長さは [manifest.json](./acoustic/manifest.json) に記録しています。

再生成は `scripts/prepare-acoustic.py`、`scripts/complete-acoustic.py` の順で実行します。Pythonのnumpyとsoundfile、および `assets/kalimba-source.tar.xz`（FreePatsの2019-07-23版）が必要です。

## 実楽器

`piano_*.flac`、`violin_*.flac`、`flute_*.flac` は
[ferrosintesis-samples-core 0.2.0](https://crates.io/crates/ferrosintesis-samples-core/0.2.0)
から取り出した旧方式の短い実演奏サンプルです。現在の再生では使用しません。

- 出典ライブラリ: Versilian Studios / VSCO 2 Community Edition
- ライセンス: CC0 1.0 Universal（パブリックドメイン）
- 確認日: 2026-09-13
- 加工: なし。Web Audio API 上で音程・音量・残響のみを制御する。

パッケージ本体と収録元の固定コミットは、同梱の
`ferrosintesis-samples-core-0.2.0.crate` の `PROVENANCE.md` に記録されています。

## 環境音

`rain.mp3`、`wind.mp3`、`birds.mp3`、`stream.mp3`、`fireplace.mp3` は
[moonseal の audio assets](https://github.com/twtrubiks/moonseal/tree/main/public/audio)
から取得した、ループ処理済みの環境音です。

| ファイル | 元の録音 | ライセンス |
| --- | --- | --- |
| ocean.mp3 | Freesound #156598, Rmutt | CC0 1.0 |
| rain.mp3 | Freesound #81818, Silencyo | CC0 1.0 |
| wind.mp3 | Internet Archive GOLD_TAPE_55_56, G55-02 Chill Wind | CC0 1.0 |
| birds.mp3 | Freesound #578523, SamsterBirdies | CC0 1.0 |
| stream.mp3 | Internet Archive GOLD_TAPE_53_54, G53-19a Brook or Creek | CC0 1.0 |
| fireplace.mp3 | Internet Archive Red Library Fire, R30-09 | CC0 1.0 |

moonseal 側では、いずれも44.1 kHz・128 kbps MP3へ変換され、約2秒のクロスフェードを使ってループ処理されています。CC0はクレジットを要求しませんが、出典を追跡できるようここに記録しています。

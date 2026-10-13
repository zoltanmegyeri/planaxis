from pathlib import Path
import json, math
from PIL import Image
root=Path('fixtures/projects/path-traced-pbr')
(root/'architecture').mkdir(parents=True,exist_ok=True)
(root/'designs').mkdir(exist_ok=True)
assets=root/'assets/materials';assets.mkdir(parents=True,exist_ok=True)
for name in ['windowed','apartment']:
 s=Path(f'fixtures/projects/path-traced-luminaires/architecture/{name}.svg').read_text()
 s=s.replace('<g id="spaces" />','<g id="spaces"><polygon id="tile-zone" points="201,270 580,270 580,480 201,480" data-kind="zone" data-name="Tile zone" data-function="living-room" data-enclosure="open" /></g>')
 s=s.replace('  <g id="cameras">','  <g id="cameras">\n    <circle id="finish-detail" cx="550" cy="420" r="4" data-kind="camera" data-z="160" data-heading="225" data-pitch="45" data-horizontal-fov="75" />')
 s=s.replace('  <g id="cameras">','  <g id="cameras">\n    <circle id="window-reflection" cx="550" cy="420" r="4" data-kind="camera" data-z="160" data-heading="155" data-pitch="45" data-horizontal-fov="75" />')
 (root/f'architecture/{name}.svg').write_text(s)
def save(name,w,h,f,fmt=None):
 im=Image.new('RGBA',(w,h)); im.putdata([f(x,y) for y in range(h) for x in range(w)]);p=assets/name
 if fmt=='JPEG':im=im.convert('RGB')
 im.save(p,format=fmt)
def white(x,y):return (255,255,255,255)
save('wood.png',128,64,lambda x,y:(int(165+25*math.sin(x*.3+y*.9)),int(108+15*math.sin(x*.3+y*.9)),58,0 if y%16<2 else 255))
save('plaster.jpg',64,64,lambda x,y:(215+(x*13+y*7)%25,211+(x*13+y*7)%25,202+(x*13+y*7)%25,255),'JPEG')
save('tile.webp',64,32,lambda x,y:(240,240,240,255) if x%32<2 or y%32<2 else (106+(x//32)*50,136,166,255),'WEBP')
save('normal.png',32,16,lambda x,y:(176 if x<8 else 128,176 if y<4 else 128,235 if x<8 or y<4 else 255,255))
save('neutral.png',8,8,lambda x,y:(128,128,255,255))
save('orm.png',16,16,lambda x,y:(64 if x<8 else 255,64 if y<8 else 200,255 if x>=8 else 0,255))
save('roughness.png',8,16,lambda x,y:(255,64 if y<8 else 200,255,255))
save('metalness.png',16,8,lambda x,y:(255,255,255 if x>=8 else 0,255))
save('ao.png',16,8,lambda x,y:(64 if x<8 else 255,255,255,255))
save('white.png',8,8,white)
mp=lambda filename: 'assets/materials/'+filename
materials={
 'wood':dict(baseColor=[1,1,1],roughness=.72,mapping=dict(widthCm=120,heightCm=20),maps=dict(baseColor=mp('wood.png'),normal=mp('normal.png'))),
 'plaster':dict(baseColor=[.95,.93,.9],roughness=.95,mapping=dict(widthCm=50,heightCm=50),maps=dict(baseColor=mp('plaster.jpg'),normal=mp('normal.png'))),
 'tile':dict(baseColor=[1,1,1],roughness=.12,mapping=dict(widthCm=60,heightCm=30),maps=dict(baseColor=mp('tile.webp'),normal=mp('normal.png'))),
}
for name,r,m in [('dielectric-rough',.8,0),('dielectric-polished',.08,0),('metal-rough',.65,1),('metal-polished',.08,1),('metal-zero',0,1),('metal-near-zero',.0001,1),('mixed',.35,.5)]:
 materials[name]=dict(baseColor=[.85,.7,.5],roughness=r,metalness=m)
for name,role in [('roughness','roughness'),('metalness','metalness'),('normal','normal'),('ao','ambientOcclusion')]:
 materials[name]=dict(baseColor=[.75,.75,.75],roughness=.35,metalness=1 if name=='metalness' else 0,mapping=dict(widthCm=60,heightCm=30),maps={role:mp(name+'.png')})
for name,rolefile,strength in [('ao-zero','ao.png',0),('ao-white','white.png',1)]:
 materials[name]=dict(baseColor=[.75,.75,.75],roughness=.35,mapping=dict(widthCm=60,heightCm=30),maps=dict(ambientOcclusion=mp(rolefile)),ambientOcclusionStrength=strength)
materials['neutral-normal']={**materials['normal'],'maps':dict(normal=mp('neutral.png'))}
materials['packed']=dict(baseColor=[.75,.75,.75],roughness=.35,metalness=1,mapping=dict(widthCm=60,heightCm=30),maps=dict(ambientOcclusion=mp('orm.png'),roughness=mp('orm.png'),metalness=mp('orm.png')))
materials['separate']={**materials['packed'],'maps':dict(ambientOcclusion=mp('ao.png'),roughness=mp('roughness.png'),metalness=mp('metalness.png'))}
materials['mask']={**materials['wood'],'alpha':dict(mode='mask',cutoff=.5)}
materials['blend']={**materials['wood'],'alpha':dict(mode='blend',opacity=.5)}
for name,mat in materials.items():
 schema='1.1' if name.startswith('ao') or name in ['packed','separate'] else '1.0'
 (assets/(name+'.json')).write_text(json.dumps(dict(schema='planaxis-material/'+schema,name=name,**mat),indent=2)+'\n')
common=dict(luminousFluxLumens=4500,colorTemperatureKelvin=3500,enabled=True,dimming=1)
lights=[dict(id='panel',type='area',position=dict(x=370,y=300,z=230),orientation=dict(headingDegrees=0,pitchDegrees=90,rollDegrees=0),widthCm=140,heightCm=60,**common),
 dict(id='point',type='point',position=dict(x=530,y=150,z=200),**{**common,'luminousFluxLumens':1500}),
 dict(id='spot',type='spot',position=dict(x=300,y=200,z=240),orientation=dict(headingDegrees=0,pitchDegrees=90,rollDegrees=0),beamAngleDegrees=55,**{**common,'luminousFluxLumens':1500}),
 dict(id='strip',type='linear',position=dict(x=400,y=80,z=210),orientation=dict(headingDegrees=0,pitchDegrees=-90,rollDegrees=0),lengthCm=150,**{**common,'luminousFluxLumens':4500})]
def scenario(name,finishes,lighting=lights,architecture='windowed',schema='1.1'):
 d=dict(schema='planaxis-design/'+schema,name=name,architecture='architecture/'+architecture+'.svg',presentation=dict(toneMapping='agx',exposureEv=0))
 if finishes:d['finishes']=[dict(target=t,material=mp(m+'.json')) for t,m in finishes]
 if lighting:d['luminaires']=lighting
 (root/'designs'/(name+'.json')).write_text(json.dumps(d,indent=2)+'\n')
base=[('floor','wood'),('space:tile-zone:floor','tile'),('ceiling','plaster'),('wall:wall-south:side-negative','plaster'),('wall:wall-north:side-positive','plaster'),('wall:wall-west:side-positive','plaster'),('wall:wall-east:side-negative','plaster'),('wall:thin-partition:side-positive','plaster')]
scenario('01-textured',base)
for i,name in enumerate([m for m in materials if m not in ['wood','plaster','tile']],2):
 scenario(f'{i:02}-{name}',[(t,name) if t=='floor' else (t,m) for t,m in base if t!='space:tile-zone:floor'])
scenario('24-orientation',[(t,'normal') for t,m in base]+[('wall:thin-partition:side-negative','normal'),('wall:wall-south:opening:window-south:reveal-start','normal')])
scenario('25-neutral',[(t,'neutral-normal') for t,m in base]+[('wall:thin-partition:side-negative','neutral-normal')])
scenario('26-no-finishes',[])
scenario('27-design-1.0',base,[],schema='1.0')
scenario('28-lights-off',base,[{**l,'enabled':False} for l in lights],architecture='apartment')
concealed=json.loads(Path('fixtures/projects/path-traced-luminaires/designs/07-concealed.json').read_text())
scenario('29-concealed',base,concealed['luminaires'],architecture='apartment')
(root/'planaxis.project.json').write_text(json.dumps(dict(schema='planaxis-project/1.0',name='Path-traced PBR review',architecture=dict(active='architecture/windowed.svg')),indent=2)+'\n')

(root/'architecture/frosted.svg').write_text((root/'architecture/windowed.svg').read_text().replace('data-glass-type="clear"','data-glass-type="frosted"'))
scenario('30-frosted',base,architecture='frosted')

left_control=dict(id='left-control',type='point',position=dict(x=100,y=250,z=200),luminousFluxLumens=4500,colorTemperatureKelvin=3500,enabled=True,dimming=1)
for name in ['24-orientation','25-neutral']:
 p=root/'designs'/(name+'.json');d=json.loads(p.read_text());d['luminaires'].append(left_control)
 if name=='25-neutral':d['finishes'].append(dict(target='wall:wall-south:opening:window-south:reveal-start',material=mp('neutral-normal.json')))
 p.write_text(json.dumps(d,indent=2)+'\n')

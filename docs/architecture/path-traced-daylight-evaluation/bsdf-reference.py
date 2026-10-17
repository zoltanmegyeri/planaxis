import math,json
rows=[]
for nv in [1,.5,.1,.01]:
 for rho,metal in [(.7,0),(.7,1),(1,0)]:
  f0=.04 if not metal else rho;spec=0
  N=400;M=512
  for i in range(N):
   nl=(i+.5)/N;r=math.sqrt(1-nl*nl)
   for j in range(M):
    phi=2*math.pi*(j+.5)/M
    vh=math.sqrt((1+math.sqrt(1-nv*nv)*r*math.cos(phi)+nv*nl)/2)
    f=f0+(1-f0)*(1-vh)**5
    # alpha=1 => D=1/pi, G1(v)/v=2/(1+v); same for l.
    spec+=2*f*nl/((1+nv)*(1+nl)*N*M)
  diffuse=0 if metal else rho*(1-(f0+(1-f0)*(1-nv)**5))*(1-f0)*20/21
  rows.append({'viewCosine':nv,'baseFactor':rho,'metalness':metal,'roughness':1,'diffuse':diffuse,'specular':spec,'retained':diffuse+spec})
print(json.dumps(rows,indent=2))

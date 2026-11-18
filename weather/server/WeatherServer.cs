using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Net;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Web;

namespace Guantian {
 internal sealed class Cached { public byte[] Body; public DateTime Until; }
 internal static class Program {
  static readonly ConcurrentDictionary<string,Cached> Cache = new ConcurrentDictionary<string,Cached>();
  static readonly SemaphoreSlim Requests = new SemaphoreSlim(6);
  static byte[] Html;
  static int Port=8787;
  static HttpListener Listener;
  static int Main(string[] args) {
   Console.OutputEncoding=Encoding.UTF8;
   bool headless=Array.IndexOf(args,"--no-browser")>=0;
   for(int i=0;i<args.Length-1;i++)if(args[i]=="--port")int.TryParse(args[i+1],out Port);
   if(Port<1024||Port>65535)Port=8787;
   ServicePointManager.SecurityProtocol=SecurityProtocolType.Tls12;
   ServicePointManager.DefaultConnectionLimit=12;
   using(var s=Assembly.GetExecutingAssembly().GetManifestResourceStream("index.html"))using(var ms=new MemoryStream()){s.CopyTo(ms);Html=ms.ToArray();}
   Listener=new HttpListener();
   Listener.Prefixes.Add("http://localhost:"+Port+"/");
   Listener.Prefixes.Add("http://127.0.0.1:"+Port+"/");
   try {Listener.Start();} catch(Exception e){
    try{using(var web=new WebClient()){var health=web.DownloadString("http://127.0.0.1:"+Port+"/api/health");if(health.Contains("guantian")){Console.WriteLine("天气系统已在运行：http://localhost:"+Port);if(!headless)Process.Start("http://localhost:"+Port);return 0;}}}catch{}
    Console.WriteLine("启动失败："+e.Message+"。可使用 --port 8788 换一个端口。");if(!headless)Console.ReadLine();return 1;
   }
   Console.WriteLine("小刘同学的天气查询系统 v2.0");
   Console.WriteLine("本地地址：http://localhost:"+Port);
   Console.WriteLine("手机任意网络访问：双击同目录的 启动公网访问.cmd");
   Console.WriteLine("请保持本窗口运行，按 Ctrl+C 停止服务。");
   Console.CancelKeyPress+=(sender,e)=>{e.Cancel=true;Listener.Stop();};
   if(!headless)try{Process.Start("http://localhost:"+Port);}catch{}
   try{while(Listener.IsListening){var context=Listener.GetContext();ThreadPool.QueueUserWorkItem(_=>Handle(context));}}catch(HttpListenerException){}catch(ObjectDisposedException){}
   finally{Listener.Close();}return 0;
  }
  static void Send(HttpListenerResponse r,int code,byte[] body,string type) {r.StatusCode=code;r.ContentType=type;r.ContentEncoding=Encoding.UTF8;r.Headers["X-Content-Type-Options"]="nosniff";r.Headers["Referrer-Policy"]="strict-origin-when-cross-origin";r.Headers["Cache-Control"]="no-store";r.ContentLength64=body.Length;try{r.OutputStream.Write(body,0,body.Length);}finally{r.Close();}}
  static void Json(HttpListenerResponse r,int code,string value){Send(r,code,Encoding.UTF8.GetBytes(value),"application/json; charset=utf-8");}
  static void Handle(HttpListenerContext context) {
   var req=context.Request;var res=context.Response;
   try {
    if(req.HttpMethod!="GET"){Json(res,405,"{\"error\":\"Only GET is supported\"}");return;}
    string path=req.Url.AbsolutePath;
    if(path=="/"||path=="/index.html"||path=="/天气查询系统.html"){Send(res,200,Html,"text/html; charset=utf-8");return;}
    if(path=="/api/health"){Json(res,200,"{\"app\":\"guantian\",\"version\":\"2.0.0\"}");return;}
    if(path=="/favicon.ico"){res.StatusCode=204;res.Close();return;}
    if(path!="/api/weather"&&path!="/api/search"){Json(res,404,"{\"error\":\"Not found\"}");return;}
    var q=HttpUtility.ParseQueryString(req.Url.Query);string remote;
    if(path=="/api/search") {
     string name=(q["name"]??"").Trim();if(name.Length<1||name.Length>80){Json(res,400,"{\"error\":\"Invalid place name\"}");return;}
     remote="https://geocoding-api.open-meteo.com/v1/search?name="+Uri.EscapeDataString(name)+"&count=10&language=zh&format=json";
    } else {
     double lat,lon;
     if(!double.TryParse(q["latitude"],NumberStyles.Float,CultureInfo.InvariantCulture,out lat)||!double.TryParse(q["longitude"],NumberStyles.Float,CultureInfo.InvariantCulture,out lon)||double.IsNaN(lat)||double.IsInfinity(lat)||double.IsNaN(lon)||double.IsInfinity(lon)||Math.Abs(lat)>90||Math.Abs(lon)>180){Json(res,400,"{\"error\":\"Invalid coordinates\"}");return;}
     remote="https://api.open-meteo.com/v1/forecast?latitude="+lat.ToString(CultureInfo.InvariantCulture)+"&longitude="+lon.ToString(CultureInfo.InvariantCulture)+"&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,is_day,visibility&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant&timezone=auto&forecast_days=7&wind_speed_unit=kmh";
    }
    Cached hit;if(Cache.TryGetValue(remote,out hit)&&hit.Until>DateTime.UtcNow){Send(res,200,hit.Body,"application/json; charset=utf-8");return;}
    if(!Requests.Wait(1000)){Json(res,429,"{\"error\":\"Busy, please retry\"}");return;}
    byte[] bytes;
    try{var upstream=(HttpWebRequest)WebRequest.Create(remote);upstream.Timeout=20000;upstream.ReadWriteTimeout=20000;upstream.UserAgent="GuantianWeather/1.0";using(var response=upstream.GetResponse())using(var stream=response.GetResponseStream())using(var memory=new MemoryStream()){stream.CopyTo(memory);bytes=memory.ToArray();}}
    finally{Requests.Release();}
    if(Cache.Count>400){foreach(var pair in Cache){if(pair.Value.Until<DateTime.UtcNow){Cached removed;Cache.TryRemove(pair.Key,out removed);}}if(Cache.Count>400)Cache.Clear();}
    Cache[remote]=new Cached{Body=bytes,Until=DateTime.UtcNow.AddMinutes(path=="/api/weather"?5:60)};
    Send(res,200,bytes,"application/json; charset=utf-8");
   }catch(WebException){try{Json(res,502,"{\"error\":\"Weather service is unavailable, please retry\"}");}catch{}}catch(Exception){try{Json(res,500,"{\"error\":\"Request failed\"}");}catch{}}
  }
 }
}

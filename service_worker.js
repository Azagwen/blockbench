if(!self.define){const e=e=>{"require"!==e&&(e+=".js");let s=Promise.resolve();return i[e]||(s=new Promise((async s=>{if("document"in self){const i=document.createElement("script");i.src=e,document.head.appendChild(i),i.onload=s}else importScripts(e),s()}))),s.then((()=>{if(!i[e])throw new Error(`Module ${e} didn’t register its module`);return i[e]}))},s=(s,i)=>{Promise.all(s.map(e)).then((e=>i(1===e.length?e[0]:e)))},i={require:Promise.resolve(s)};self.define=(s,r,a)=>{i[s]||(i[s]=Promise.resolve().then((()=>{let i={};const f={uri:location.origin+s.slice(1)};return Promise.all(r.map((s=>{switch(s){case"exports":return i;case"module":return f;default:return e(s)}}))).then((e=>{const s=a(...e);return i.default||(i.default=s),i}))})))}}define("./service_worker.js",["./workbox-1cb178f3"],(function(e){"use strict";e.setCacheNameDetails({prefix:"blockbench"}),self.addEventListener("message",(e=>{e.data&&"SKIP_WAITING"===e.data.type&&self.skipWaiting()})),e.precacheAndRoute([{url:"index.html",revision:"0f4b1f82c2507fc6dd3afea05516a687"},{url:"favicon.png",revision:"bb17c5c284076fc17e3399860df472d7"},{url:"js/animations/animation.js",revision:"59473d6bad74dc06527cec1f657e33d1"},{url:"js/animations/keyframe.js",revision:"a818e8776bc1bd8e81763ae2eb29ea36"},{url:"js/animations/timeline.js",revision:"8b52e926b8c3f1e587faf7e5f8624637"},{url:"js/api.js",revision:"842a7ba6adf5ed76ae9adb8f1ebd7c5d"},{url:"js/blockbench.js",revision:"5bd12146f589448e4d3682f188ba0942"},{url:"js/boot_loader.js",revision:"5aa6ff6b408b16bd058240ae7e30bcad"},{url:"js/copy_paste.js",revision:"ff33af0fa5bdf96aad1226f00a268cb2"},{url:"js/desktop.js",revision:"8940f57f728cdad70bd01a49c8ba15fd"},{url:"js/display_mode.js",revision:"8f0b03c2653bcba8d14c62d64a178283"},{url:"js/edit_sessions.js",revision:"d465a247a8e8c5dd888ed69a89d7122e"},{url:"js/file_system.js",revision:"117b51062c55b0fc30584ea88c9c067d"},{url:"js/interface/actions.js",revision:"2e41a9f9454ff52cfe18e3b8b8dfb608"},{url:"js/interface/dialog.js",revision:"a54813dc8d149116dbb02b9912efa887"},{url:"js/interface/interface.js",revision:"afcb735dc18a225c733b2f3641edebe9"},{url:"js/interface/keyboard.js",revision:"4a5dbd04ca6d1f5b982cf2200fa213c5"},{url:"js/interface/language.js",revision:"21771fbb44f4a6b540aa7914610214b2"},{url:"js/interface/menu.js",revision:"308607b6b327b0f7e0563dd286c493f4"},{url:"js/interface/panels.js",revision:"a80b9082797ce7373cba8873fd03e77d"},{url:"js/interface/settings.js",revision:"c4d75c163d573c6d81e645dab3b22216"},{url:"js/interface/themes.js",revision:"04dfdc64ea091085d0008631936d34f3"},{url:"js/io/codec.js",revision:"90ffac0fbfc9dfde9f1ab14a0b85e2d4"},{url:"js/io/format.js",revision:"b4e463a603dd8dcd9b54ff1561e75188"},{url:"js/io/formats/bbmodel.js",revision:"68402e1976788f5099efce3780c5fc08"},{url:"js/io/formats/bedrock_old.js",revision:"c12418fedf2413a0f944802ca04d52fd"},{url:"js/io/formats/bedrock.js",revision:"7140de386a5bc8d05ee7850f3a75c74f"},{url:"js/io/formats/gltf.js",revision:"e8dac5448c6bf3849af21e00f9940b8a"},{url:"js/io/formats/java_block.js",revision:"3d14043e6eb7d3def6aba25c154d6b82"},{url:"js/io/formats/modded_entity.js",revision:"4bdcedbfb35fa183ab4e9ebd820cbc9a"},{url:"js/io/formats/obj.js",revision:"8745ce378c56e0410f4aeb8aac14e049"},{url:"js/io/formats/optifine_jem.js",revision:"c43ed6a97d5af5ddf5d7c41b13fc5641"},{url:"js/io/formats/optifine_jpm.js",revision:"bb13277b217c48e376dd2e4cd85d10dd"},{url:"js/io/formats/skin.js",revision:"e376a09f98e3bd988c1cd8b4aa80260c"},{url:"js/io/io.js",revision:"f81dcc495be6c02faffddd6fee4c1b1d"},{url:"js/io/project.js",revision:"b6f5f90090d6a9c2ca049ce3ec4470d9"},{url:"js/modes.js",revision:"0e19db1f46e6a9ad7dd368aa2d698e0b"},{url:"js/outliner/cube.js",revision:"40feadb0930730e0cd60b611bd1c9d56"},{url:"js/outliner/group.js",revision:"6df432ed389e9119a1d2da2ad7dd8a6f"},{url:"js/outliner/locator.js",revision:"3f84ecfbc976e9c59e44d18046dea779"},{url:"js/outliner/null_object.js",revision:"1fd2e18a384c7f10ef1d8acc183e75b1"},{url:"js/outliner/outliner.js",revision:"08a4b84fc6b42c6a9498e558441be90a"},{url:"js/plugin_loader.js",revision:"f0247f297a66ddd1ffc44782271e4f95"},{url:"js/preview/canvas.js",revision:"dde9c27e09c3f6a8f36117f6bf25dbe2"},{url:"js/preview/OrbitControls.js",revision:"c4d7a1b66a76d215048a9354dcd35240"},{url:"js/preview/preview.js",revision:"c2ceaaaa1c93bcfecb81bf7603589d3a"},{url:"js/preview/transformer.js",revision:"39b2904764c3ab263964d660f80da818"},{url:"js/property.js",revision:"63d106853fedc6e65267897fe5b732d1"},{url:"js/texturing/color.js",revision:"c9ada4bf127abe1f0de94ee8e461cf3b"},{url:"js/texturing/painter.js",revision:"cd552ebeb8030c5cc133eaad41e26533"},{url:"js/texturing/texture_generator.js",revision:"8cd0498210287cd645d7dfdecd0c1434"},{url:"js/texturing/textures.js",revision:"f69a52e23d3c7e352a2b213fc475cd89"},{url:"js/texturing/uv.js",revision:"d87cd7946fbfbbfa4efd487ea7642ea8"},{url:"js/transform.js",revision:"1a90b79e145176e011b71bbaedbe2098"},{url:"js/undo.js",revision:"556bf308b60d148cdc8b9e530612b199"},{url:"js/util.js",revision:"19a0419cc7d78b29df2e711d0f0fcab1"},{url:"js/web.js",revision:"6b23b98f38f4ca6140f8afd3c7ae6667"},{url:"js/webpack/bundle.js",revision:"778faeeb1aa508ac052f988709ab3211"},{url:"lib/CanvasFrame.js",revision:"af677de11b513f6c8c8ff96e31e59acd"},{url:"lib/fik.min.js",revision:"9985a46a1107966f2375d0c61241c689"},{url:"lib/gif.js",revision:"5fa535a97773b661a4e8f20249f92b2b"},{url:"lib/gif.worker.js",revision:"d8cc71ca8334b5002e4481497802c2ac"},{url:"lib/GLTFExporter.js",revision:"b605b9395556525b4af19e41ee468d70"},{url:"lib/jimp.min.js",revision:"44fc5c9cee92b9d0d7738f21353297b9"},{url:"lib/jquery-ui.min.js",revision:"f7275ece7d6dea2aec3c23457415695c"},{url:"lib/jquery.js",revision:"2f772fed444d5489079f275bd01e26cc"},{url:"lib/jszip.min.js",revision:"9927b911fee8d35162919d3790c7d492"},{url:"lib/lzutf8.js",revision:"37d1ff3b0710ba8961bcdc2c560baa17"},{url:"lib/marked.min.js",revision:"589a61c766b709a5767f76b05176459a"},{url:"lib/molang-prism-syntax.js",revision:"dd6357564e2f8b337c79959d5513c5eb"},{url:"lib/molang.umd.js",revision:"f4f64bb8e5d704ef5c7c0bae35999db2"},{url:"lib/peer.min.js",revision:"0ef81b5aaa05038637b792d78cf822cb"},{url:"lib/prism.js",revision:"f60031ca28963cd4f765111f42cbf615"},{url:"lib/spectrum.js",revision:"3d50fb1a9dca2f9d8add7db7216ecf0a"},{url:"lib/targa.js",revision:"17c5ce65af686baa97294748f929541e"},{url:"lib/three_custom.js",revision:"c3c35c6307d21f4565795d9ea1158432"},{url:"lib/three.min.js",revision:"5b5ab140f46a6c4b78449c23332ed78a"},{url:"lib/vue_sortable.js",revision:"87cfedd91d600fb8d44668a0e83d4101"},{url:"lib/vue.min.js",revision:"f121238864e2a9ff7e97bf60b159feb0"},{url:"lib/VuePrismEditor.min.js",revision:"8f5640c24ff4b75b71d04772a23a1f5d"},{url:"lib/wintersky.umd.js",revision:"16fe6292d2494a0f23501f975867d8b1"},{url:"css/dialogs.css",revision:"f7feea5c3e5158d58e743561b896867a"},{url:"css/fontawesome.css",revision:"c495d61f0f4ac5620822edc1eb6c669e"},{url:"css/general.css",revision:"8f5bd06342f29da623c057de908dfda9"},{url:"css/jquery-ui.min.css",revision:"db778110650dea1e4533cd09f75533a2"},{url:"css/panels.css",revision:"0a6e0ccc012fbda5ce32b23c531792cc"},{url:"css/prism.css",revision:"d67816ad66eac995b77611057f3df62f"},{url:"css/setup.css",revision:"9c479c072c1f1bcc60eb295defab3e7b"},{url:"css/spectrum.css",revision:"88d4d9b4237ae38c56aba114a022a9bd"},{url:"css/w3.css",revision:"129107477d8b94bf3177ac5a4178242d"},{url:"css/window.css",revision:"59b5640c26fc60ea9a53d78bdaf00360"},{url:"assets/armor_stand.png",revision:"3df02c489fe7757dab55113d4fc057fd"},{url:"assets/brush.png",revision:"b6a28bb79f9dea063d7a2ac620a3236a"},{url:"assets/hud.png",revision:"049320fa871e4fbe54978dd6043acd8c"},{url:"assets/inventory_full.png",revision:"430fc3c0627f04302d457eead5e1fa16"},{url:"assets/inventory_nine.png",revision:"28cc307e3f2ee4570532fe6ee01a6131"},{url:"assets/item_frame.png",revision:"08eaa797bfb1ceb3784b6fa04ce77387"},{url:"assets/logo_cutout.svg",revision:"1a2b2e5db76846d910af304e87605aee"},{url:"assets/missing.png",revision:"a1f4bd77899273e5327e1e206aca4065"},{url:"assets/north.png",revision:"d6c44f75fe7a6dd16927b9b8d8d0e9c2"},{url:"assets/player_skin.png",revision:"785a0d44aa606a2518465a883e6b7b8c"},{url:"assets/zombie.png",revision:"648e846e49c7563eb2625f39b76155b2"},{url:"font/Assistant-Bold.ttf",revision:"d582391da9a68daf10a2ed2514c33826"},{url:"font/Assistant-ExtraBold.ttf",revision:"f2bbc6bae2ee3ce641adc1bb1a655371"},{url:"font/Assistant-ExtraLight.ttf",revision:"5e4d348ae3eca48143c0274a3124a9c0"},{url:"font/Assistant-Light.ttf",revision:"5415f395c1567a5c19efc1dc2892927a"},{url:"font/Assistant-Regular.ttf",revision:"e2b46dd69f54e57767ceef1d5fc8e688"},{url:"font/Assistant-SemiBold.ttf",revision:"d6759edb35ac7f29a029caa1192c010d"},{url:"font/fa-brands-400.woff2",revision:"5e2f92123d241cabecf0b289b9b08d4a"},{url:"font/fa-regular-400.woff2",revision:"e6257a726a0cf6ec8c6fec22821c055f"},{url:"font/fa-solid-900.woff2",revision:"418dad87601f9c8abd0e5798c0dc1feb"},{url:"font/icomoon.ttf",revision:"d934103b67bea7bd5a866bf1c2859607"},{url:"font/icomoon.woff",revision:"ba224fac85aa14b3ec40f239042abe12"},{url:"font/MaterialIcons-Regular.ttf",revision:"8ef52a15e44481b41e7db3c7eaf9bb83"},{url:"font/Montserrat-Regular.ttf",revision:"f7213526ec9296ff43426bfe3eae8926"}],{})}));

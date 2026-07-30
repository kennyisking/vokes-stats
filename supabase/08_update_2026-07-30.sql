-- =====================================================================
-- Vokes POC — data update 2026-07-30
-- Run this in the Supabase SQL editor. Safe to run more than once.
-- =====================================================================
-- Brings the database up to date with the latest Airtable exports:
--   1. the "TBC FC - 28 Jul 2026" match result + its 5 performances
--   2. player photos    (from the All-time grid; Airtable URLs — see note)
--   3. "recruited_by"   (Who bought you into the club?) — new column
-- Nothing is deleted; every statement upserts or is guarded by IF NOT EXISTS.

begin;

-- ---- 1. the TBC FC match result ------------------------------------------
update matches set
  goals_for      = 3,
  goals_against  = 8,
  result         = 'Loss',
  weather        = $x$🍲 quite hot$x$,
  one_where      = $x$Andy couldn’t be stopped$x$,
  match_report   = $x$> The one where... Andy couldn’t be stopped
Joe Day: Undone by a better team 
Harry Wetherald: Battered 
Sam Broadey: Andy the grim reaper 
Hugo Hensley: Succumbed to screamers
Justin Hubbard: Heartbreak  
$x$,
  motm_player_id = (select id from players where name = $x$Hugo Hensley$x$),
  dotd_player_id = (select id from players where name = $x$Harry Wetherald$x$)
where fixture_name = 'TBC FC - 28 Jul 2026';

-- ---- 2. the 5 performances (idempotent upsert) ---------------------------
insert into performances (match_id, player_id, goals, assists, errors, pints, clean_sheet, disciplinary)
select m.id, pl.id, 1, 0, 0, 0.0, null, $x$Not for me$x$
from matches m, players pl
where m.fixture_name = 'TBC FC - 28 Jul 2026' and pl.name = $x$Joe Day$x$
on conflict (match_id, player_id) do update set
  goals=excluded.goals, assists=excluded.assists, errors=excluded.errors,
  pints=excluded.pints, clean_sheet=excluded.clean_sheet, disciplinary=excluded.disciplinary;
insert into performances (match_id, player_id, goals, assists, errors, pints, clean_sheet, disciplinary)
select m.id, pl.id, 0, null, null, null, null, $x$Not for me$x$
from matches m, players pl
where m.fixture_name = 'TBC FC - 28 Jul 2026' and pl.name = $x$Harry Wetherald$x$
on conflict (match_id, player_id) do update set
  goals=excluded.goals, assists=excluded.assists, errors=excluded.errors,
  pints=excluded.pints, clean_sheet=excluded.clean_sheet, disciplinary=excluded.disciplinary;
insert into performances (match_id, player_id, goals, assists, errors, pints, clean_sheet, disciplinary)
select m.id, pl.id, 1, null, 1, null, null, $x$Not for me$x$
from matches m, players pl
where m.fixture_name = 'TBC FC - 28 Jul 2026' and pl.name = $x$Sam Broadey$x$
on conflict (match_id, player_id) do update set
  goals=excluded.goals, assists=excluded.assists, errors=excluded.errors,
  pints=excluded.pints, clean_sheet=excluded.clean_sheet, disciplinary=excluded.disciplinary;
insert into performances (match_id, player_id, goals, assists, errors, pints, clean_sheet, disciplinary)
select m.id, pl.id, 0, 2, 0, 1.0, null, $x$Not for me$x$
from matches m, players pl
where m.fixture_name = 'TBC FC - 28 Jul 2026' and pl.name = $x$Hugo Hensley$x$
on conflict (match_id, player_id) do update set
  goals=excluded.goals, assists=excluded.assists, errors=excluded.errors,
  pints=excluded.pints, clean_sheet=excluded.clean_sheet, disciplinary=excluded.disciplinary;
insert into performances (match_id, player_id, goals, assists, errors, pints, clean_sheet, disciplinary)
select m.id, pl.id, 1, null, null, 1.0, null, $x$Not for me$x$
from matches m, players pl
where m.fixture_name = 'TBC FC - 28 Jul 2026' and pl.name = $x$Justin Hubbard$x$
on conflict (match_id, player_id) do update set
  goals=excluded.goals, assists=excluded.assists, errors=excluded.errors,
  pints=excluded.pints, clean_sheet=excluded.clean_sheet, disciplinary=excluded.disciplinary;

-- ---- 3a. player photos ---------------------------------------------------
-- NOTE: these are Airtable attachment URLs, which are signed and will EXPIRE.
-- Treat as a stopgap; re-upload via the site's photo tool for permanent images.
update players set photo_url = $x$https://v5.airtableusercontent.com/v3/u/55/55/1785420000000/KQWpdFdsv-_A00_NxvtXlA/T1AgUCcx2wUupGaEuQCCLq9W-7h8DGtTlL6fA7WRf2x9KQOI-wgBwSArAfkh9ow0kd7KICOXl17vyMMbk5KYKM_4dIk-gfw7uaomCLwvWNSEAS0dcHzojLZ07eo6RKBdkXS-qbVHrEhSaXzso-IWDc64B1DdG0Anxms8hs5s9q4/-H77e9XPtiVATgGcMzF-Lj0VuFfj6MEDTzvpjA0aOBI$x$ where name = $x$Sam Broadey$x$;
update players set photo_url = $x$https://v5.airtableusercontent.com/v3/u/55/55/1785420000000/8Acc7sxFk17wwW6I3HUc1w/YAuMfCHwYeAe0LR-t-01eZJnG14fEqnEXGSSVfr2J3d2XIEIhpmPx3uTQNxtLRqXaGzlxC0aRA8E_mckmDhFL5E-enoeVbCGSwzdc_kh_swHqzoTqErTKcaY3GuzsYr8WmH3G8dqXzpo8sxZw7AudRD3IJ-cctxc3gFpb_MXxH4/Wcj_76b591JEgFCUvRhYLpzbmTKwkjCqnlDwdtjUhl0$x$ where name = $x$Joe Day$x$;
update players set photo_url = $x$https://v5.airtableusercontent.com/v3/u/55/55/1785420000000/T7nR-J_C3j8Dmb-o9HAImw/sYfoSQafyz7cJEv-WuaWouzfgazvQ_iamzCzUieHTiY4HJxKIMq-3g98TRdV6IPADFUtPDVLHgiDOlb1RutbErrrNYq44OkU8YtGS05aEpkB9cs0SKGmGYeKrbaNW51uswngko831_vbyiNqOe1nG7GQ8EF9O_L5v9swK06G90s/0RAzr6jF7NQAfbFdlBDcqEU1LjJnbGPoTlGLNgbOODA$x$ where name = $x$Hugo Hensley$x$;
update players set photo_url = $x$https://v5.airtableusercontent.com/v3/u/55/55/1785420000000/QGeWNWemQXwZY_QedMXcyg/x9QPUndQcDs_LAfW-zqJchHoTkMwAvoWXXe4PXoifHVGCR3y6BCx-L2D0Oku0mD4zrRTkS7LQQTpw0PnasTSdSuovawE3XEx3dcR2EuxklfbyLpcZJy74a8PcswZkON5gTqRbtOLtd8OitUkt6Lj08GORk0eHfweZAoX2QLXqE0/Y0EkD63ExQMwVVrNyMU8gX4Dden6U7lRJRmoXElEIsA$x$ where name = $x$Justin Hubbard$x$;
update players set photo_url = $x$https://v5.airtableusercontent.com/v3/u/55/55/1785420000000/dWER-VL7A1q-s5ry9qn7zg/o6pXmozKT6go56FxeWAnKF3427n0HOAdCn_zwt_48TL_Q2hAEEB8Z0kwWfhLevbLX59HSbUb_KOQ5w9LPASr9BnFVR19a9u_rAx-x_UeFxosJGCGoL3OHEvn0RILL3-NsayeaoRa5z93uWloHP8WWKqVS5sMY9jocDPyck2e3U0/5MAyd3j4-Px0iVQcciIBh1J8EeoXtJGvVbbSFEjr-3g$x$ where name = $x$Ozzy O'Sullivan$x$;
update players set photo_url = $x$https://v5.airtableusercontent.com/v3/u/55/55/1785420000000/yJGsnkVBQtvdcm7w7yMYuQ/8t5v5xZvkOz42qtX9koVdTwty0yFHkqlhTrWnudwiBqCBx_4MQFO0G25dvCn2ngflv6Jm8wbd-fTGSOLB_l1wq-8ylQOdfxHdCmuUecCU6ZbMGRMQJvAJMM8iZMUCwKlDyNPQmC04Zgby50HrZZU_BdWY5WWdev6mZ8vj3t_9VQ/48mSqX46W9Pm_6jnbi82zRIdoP4zA0SKYNFRZp96GWo$x$ where name = $x$Harry Wetherald$x$;
update players set photo_url = $x$https://v5.airtableusercontent.com/v3/u/55/55/1785420000000/umpYh0MBV6hyCKMi4JrZoA/Zgd0Nm0gvopSZ2h5wwUEgMcz4T2TJKT7NiRV_M9UJ3iPRai4LtcId55stlxRWqQEV4TybT-ucBilx5KUf7NY8MJSTRWCEaqxtb_W3vmp3SIhuCrTQxaKMt15CgbTEFJr_VlpTM2mqsCqiGu067qjE0_FwNhKFhxmxNluKFhJ_gU/6G56_EEkGRSr0mEKRxBIWKAjCCRd96gY_1ngq3EafFA$x$ where name = $x$Alex Monk$x$;
update players set photo_url = $x$https://v5.airtableusercontent.com/v3/u/55/55/1785420000000/0gZw94RdbFGPVa00DeYhHg/fYsqISH6vQN4xzSvSQIdVsQ1EOLCHbayEkixCJ0HVBSX2qmPQde_eDCz5rFuXUxOaaIwPCz19KiP53ofIihijLPTaLh-jzBZx3AT0Xfymoql5JiEATqxCI4TlPfRJ0NCGRCO8DPye0L4TEzWiFAi_8U8SRVPfNOkjLc6aEZ-lIc/nMcJ4x3F8Rltd6DbHgVMSCFZNNcrTqggklpvWPOgVe4$x$ where name = $x$Ario Aribaldi$x$;
update players set photo_url = $x$https://v5.airtableusercontent.com/v3/u/55/55/1785420000000/rWpd25UAq7zWYmoFkPqEXQ/RX3TfAPmmVlwpuMmj9Ssr28tcaS4LySp--gpuQz4w-Hh3OfV-vWHVcR5q4CovP-dAu7gUAnVeW_VPAgAf5QGz81o_DIVvTZ6qRBJpWBEolk_23-I9qQyNBeAyCGsuT5xmdBmSC8mkfexnl_0Q72iy7PgBnwrXi0CTgUkxzGhJRs/bD4FJhJmW066mt7-2P1Bl8ON50ll49LdxjT41sgWa6w$x$ where name = $x$Josh Platt$x$;
update players set photo_url = $x$https://v5.airtableusercontent.com/v3/u/55/55/1785420000000/KbdUczF3YxQVVYzXVydFEw/IAljyTWyDItxhEeSGM5UY-bkZGuUqW6oVjMrMGQgw2wxfDzfpYeq0GMWzJR2RrY3wRJxECbTvJ2TUwIB4904QarDyaMSRyuNV1KUD5jJLWmHgdrZw4m3ZXutkBDQ8Bj_kIf0zJVlARLo1N6u5y2oUjCvfVY9o_Eiy1vAvrmGgsA/IpSqQFDPNGjYVGhIC4wkkhRbwVR6aht4ocph5UVzsrI$x$ where name = $x$Jon from Hugo's work$x$;
update players set photo_url = $x$https://v5.airtableusercontent.com/v3/u/55/55/1785420000000/yGR8LYZq2FsX4YnWt8GQIA/6VISR6CbljeJhI8gPRrL7dRH5BXxyRxAIK66hUuUuZRuKXPuhGTzcIyugYvFubmrwk1oCPDuHnct0EhV04ycn0Y1EVo6Tfnv1yHk_MeLpxMmB0k-buJiIlThr4cjEH8in_I6KapDWwvTeaLoTJGvuoRFJdViGshuliiYlpSkrJY/Onup7yvB0XoNA4Holk-cyfc9tPugeS1TPmyiEVf975o$x$ where name = $x$Mark Hattersley$x$;
update players set photo_url = $x$https://v5.airtableusercontent.com/v3/u/55/55/1785420000000/arh1JwvHGzwRVRDbjg91pA/wmMzhqeJ32S0i7xfhWTFUn08TNYMmbo6NL-abjR3HgY9IpU2l0IuxQAOMyOH2Yb-kO7QAe6G4B1h5WUxUeDEJ6U7GM6M-G3ZBdP75XeXUEWNb8Z-YrIT92d54_-LDC2PPMvAaUaEKIOQZN8zGJ8SiVxH3wHa1rEDGdU2cmO5UQo/70kllJiISMrjcJAtXcd4eRcvt02oI76wewPCCUC3B1I$x$ where name = $x$Jack Hobbs$x$;
update players set photo_url = $x$https://v5.airtableusercontent.com/v3/u/55/55/1785420000000/dsiikZPKUwvzA_bt42owOQ/MKJSjYnEsvrxfIw0YcPmu3CP8rJFJMHR0ZJ5bTR27Ucc7E5-vLv0CzOssElkl2INHLccL0oTsrHp7yasz2N8BiSSrQwYhgqyMRQBenSukevjFxODlr_fsO7ZmimRpHoCpuIUcppNtPvBJ-A-f7qE_nsfB-CtjXs7VvnMqPgFtwU/2lD16sM0qivKMaNVAlyvkP_nxbt9tDF8RZzxcbGdBfs$x$ where name = $x$Lewis McCormack$x$;
update players set photo_url = $x$https://v5.airtableusercontent.com/v3/u/55/55/1785420000000/jAASgZNAmQhw9mg67Sb5Xw/c_gr_LroSmAHpmVONwEdveINLhVt6JYDDtyZf45HIXmTOqJTmNCWlWp3hmZnpxkqOGEU3ofzqb2hVZOvu0Q4bMv6eCOfGPtcQMoQL7E_h0w99R0shQjsAeD72H2ng6G2gLxCQZJDZeK5_mfIpVS03w/n_1jI70m8h1MjbjCX75T81QGlRIb7MwnDuafGgrx6Hs$x$ where name = $x$George McCrae$x$;
update players set photo_url = $x$https://v5.airtableusercontent.com/v3/u/55/55/1785420000000/jWkW2yt-NWCWs1BRnRxy3g/lY1AKiolsVWjVNA7_KltNhR0OdgkedEfgbG-a4z52X-Z4jxCV287kH7FNZIhoWcBzcE3lQMHO6NaJsE3AqdSMPcqTRQLR4EnsHt6eHa9zfhKmkBvvi63fxay0-u9KWGCVC9okFV0-zoHeTN_BU00Ive34-wzgoLb-fca99_VQUc/tCHH0PUUWlWnCyM5q2sSz1CnamgEsG5O5UNZPxYmlWQ$x$ where name = $x$Fed$x$;
update players set photo_url = $x$https://v5.airtableusercontent.com/v3/u/55/55/1785420000000/uJnZPy8_mbi3ooPNzEnnVw/FX64lYbt4FhV9FBgWlKpVb-II48UnD3EkLQlxaHmFHgXxdK5E6v81AxrNAUNnljP2GqebPgNRzPy60P7-XUdvvNo5iLy8aLYddUiZqz8kzeBuPzaZAKUjxRkylNhqo_2XFzsNIdiRx7v74DpNCqvDW7f1l8PbfkH2HUrD4cWOnc/q98yAORFjIp62b3BjvsYpSG-ZmEgPHc8jyiCWzdzdnY$x$ where name = $x$Jamie Slevin$x$;
update players set photo_url = $x$https://v5.airtableusercontent.com/v3/u/55/55/1785420000000/hVY_bKj-dBKRJo4Y6Gra9g/r6AyDf5XEWk2z4iRpyX41VxL3iEBdVzaUbunp5-auybfQ56tJ4IxAKcqArWbtx9Zhvy8Ap2NIuAS83QQVUq6ZP8HG6ZV7rwCVTO7LhfzXMoxd1Os5sVlXsfdBfrUgefEt_khfsUuexEPaphq5U9dZHvs2WYNk6794lhUv0EuvYs/H1QGbYvE974YWyc_Y6mX-nKW4Yli8Yym4Ec7V9QcPts$x$ where name = $x$Nick Sacqui$x$;
update players set photo_url = $x$https://v5.airtableusercontent.com/v3/u/55/55/1785420000000/_nDaPKhWIV-DrHuu_vZWgw/KdUf86xlr3qmI9pMCFXFn-aQY4yai68GaUrQ9YSeGTGTlG2cA0e79GNiVtd-dIwRO57RPTRMdEUETUEP5y5giJutq2KDv6Pq9T9LbKO3TNC5RXkNKHV8l0b44-I7KWKT_Nv5XLXONNUM_rFKpbTrwC7BV7Ex3AudCmshI_A88oM/SsjZJbMaeMVII3aGI1UKNlTnhOoEn301CK1p3PSGOqw$x$ where name = $x$Matt Morrison$x$;
update players set photo_url = $x$https://v5.airtableusercontent.com/v3/u/55/55/1785420000000/BQtOOXspvotWGwf4P7y3gA/rIaKjqQCkx-n19JGN8p-qzDvksa7xOYlJxh5yATc98d2TEpzK1i2Hzkqm5CS6gOyE9CXiMx7J-Tx2DDPqzsAN--uP82QPEC9gL7v_te9cHtKMucCtzfyrdrckKFsy6YFWXYDxJ7ZRg8Rh-WRMMTo9LyHB_cdkLQ2nEICmQglcVg/RAr5WJDV2UFZpoZkDL8WKJMcZx01v0fEFu4hNHcecVI$x$ where name = $x$Harry Sturgess$x$;
update players set photo_url = $x$https://v5.airtableusercontent.com/v3/u/55/55/1785420000000/PUXC66pDJzE72BMhSjSiKw/e0xzjN7EY2SOyjhD7rSacciFX0E1CgfYa3Ice-9y7HgrCvcD6hbbMnfggO_NNclUsaSLfBmloGtETMIVZqLRRcVyyM3Mg_Y6TeFBjj3rtjNfdJ2DNC3o6wLL4O-beSHnYqkEFOeiX6CI-Q3GybvY9GYHdc8i8EzqJ8O-qqoIpaA/hKNlHmwvEcy4lMVnUoZUNC3vKh2D9Aj4WXhyLVLPlOs$x$ where name = $x$Alec Schaefer$x$;
update players set photo_url = $x$https://v5.airtableusercontent.com/v3/u/55/55/1785420000000/Dmmkos_MXbUiW8FpR_SNkA/z43ZibrR5Zz8Gms8-UrTg701VuDykEQ5p3C0_3YLZYwlMiQ1tCTlZAeaEz1zYENU-VZDfsYpBnE0nouaPFBlgzgtZjoyi34PJBlc9RLkZj4Jtf5vPK-w-NNlpkOpNitnBDyXSw0Q4Kl0plor-Ev0iQ/L8nUu8SjNXTJrHFBpdM4ecT0EQB-xHtAgQqMjH6FIAo$x$ where name = $x$Matty Naylor$x$;
update players set photo_url = $x$https://v5.airtableusercontent.com/v3/u/55/55/1785420000000/096BpTGgYLPZEcm5SKaWag/uuDivoGcsOwsr-1FoMQvbyCymXWFPKqD0qIdNIqIqAArm9BdbAkrdoTmLXUqQCARFjHiQyjvHP9lvw0ePSzGawHgS9s8IYAwi_FG_hmfSflyBpTJB6zg5uwRIqMdRMuqVLny7blElfUGHdZC0_HHDA/hMFzMU2zb0XzM8zxNPvQl3rAzthQ9-kCdfS_-FJcwNE$x$ where name = $x$Fred Bouttell$x$;
update players set photo_url = $x$https://v5.airtableusercontent.com/v3/u/55/55/1785420000000/rrk-8IP-zXRVPvsNMmtmKQ/WNtvR-m0H3MouJPttTqNQHbgefiPTMRJBrEvJyl4DkWOj6ie692H6cbxZnUD2cBF6RpQdaBWWtlO-tsGq22pMg3Wqs1v_x9U-MCL2UjxqSN3woYWCxMnD84iZqSDjwtXJNK41RB-WnPHdntisC4DR6HwvP_SS0s2_DTaRMRrhuU/8_qGzx2OzLRgjeOvBkKUAm9ecgfKAOcgDbMTb2-GlPM$x$ where name = $x$Charlie Beard$x$;
update players set photo_url = $x$https://v5.airtableusercontent.com/v3/u/55/55/1785420000000/FryMGxcFHpsTnBoYdbXN6A/UNFa7ywwRZPjTjZvOqzTSlFNUsUwBwwIjmVS7oruzrbATR4s-tpv8TnbjkPBr_0EfP3QZMMTnvAQNihLlKtL0FUB5wX6hVq-9Tamp6hfNluTBpRQipklM7Wn8aeAQqM6pQu1pm_OQv3ZgM3LlU_jQg/uA9N1_j_CgwFy0W2Iilq9yIDu_1xPAQymQWlfktHWEM$x$ where name = $x$Scott from Hugo’s work$x$;
update players set photo_url = $x$https://v5.airtableusercontent.com/v3/u/55/55/1785420000000/W0fpKAdu_z0rUURRKKWj6A/-BOnMtujN7yFt1oP8KfKEj4oFhd9EAgnpxEcxyiSAuwrTe_OBgizjnDwvL3BnYSkVmer1s5jfcBW5w39hLdm9kj_cA3QBoEpd2_-g60aHNDRcerEaOK3XxXATbNF4KjTs3Tp6g2NkhVeCKN7Qlq2DBc-JfOQJtt0OphraDBeUb_DYHUHGZ87Kx2s-BwWqRxqSANDDElvkmybCyf6mAUrkw/qhlIDakT5g07jMs_L8hzIstDkRrKGnpZvdYoGr_O4xY$x$ where name = $x$Mannat$x$;
update players set photo_url = $x$https://v5.airtableusercontent.com/v3/u/55/55/1785420000000/12tvd3-Dm9RvZdZzrOd3lQ/0vNrfp-jEQwnVIETAIuudr_ZDtvhzbwdHjJDM9IZ36wGxtuexp4m0sGjRGK0kJrEPZ17mj_GFLbB6BTIgfwIsP3r1ArckR4nFuQkcxepNGqDZwLYsAGf_MSwpT3Zkq1Q_r41U6s1A_AVO0TQS7FONATrUsLCKD3WyD4ltiFZpig/sFs9wIbiC09USbJOAJaBcJQ9lzlhHphfqP8M7-kLtXA$x$ where name = $x$Joe Bouttell$x$;
update players set photo_url = $x$https://v5.airtableusercontent.com/v3/u/55/55/1785420000000/R-W7dd2kzKdv51OhyMRhhw/_eUOu2V9sEmJ2EvCobpmHBFK_NPRIciqK98e_CAHPMkILk3L6M9SSDUcJJr-WvB9CAvaCLrXTprl81Ueek8AJDLmggdsNUErha78S4RFR5IYJpBY3LkZJUgLKCiMU7RWyadMzi1mQnr-5gd5QKQmD-qGmWAdDQ_-Qt8mv5IkFHc/zNPcmPj5jLWKBxFqDh065DrpDDoo2fjYXy1Eeur00R0$x$ where name = $x$Rhory Ashworth$x$;
update players set photo_url = $x$https://v5.airtableusercontent.com/v3/u/55/55/1785420000000/Svqv9TWHmkJgemXC1sARVQ/sUjSY0HlzEsNjVrRgnPs4sUCJC95YWfam0IJ6A7sYh0qPVrMtNYFOaJMf0FLaIF8CCy6gy1equkA2tDLX-MD9pT48Mb-7Xioc6OGzZAlagupjDliHDa5VxpTUQ-iQ3_MTGw3vsNsOblHm-ANIYzRYg/fNJduj4MgHnWOGjXL3LzT4CAS4kIE1I4NafzFdEYluI$x$ where name = $x$Ed Smith$x$;
update players set photo_url = $x$https://v5.airtableusercontent.com/v3/u/55/55/1785420000000/bTfnXZoOY0jKQD5BU0yqPw/apS8z3io1DMVKbXA5k5T1SzK6LkiHlBuh8rPYy66vtXt9youj75ll3q9U3bcuDVkM2LaLUfFCbWdWy2x6hhjNE5P4jXNonQyEAvho9Qf3UMg7PSS97cqaOne_3cUK_v1entzyUBtwVF1ptXjLnK59mv0FR40NiUeZV8Hie_smyY/hMnQek3fQEgPU2WvDvX6A3jXzo8j_0i4NB39lG8fGxM$x$ where name = $x$Tom Medlicott$x$;
update players set photo_url = $x$https://v5.airtableusercontent.com/v3/u/55/55/1785420000000/Z4_cqUVF-vXUIUb7usSroQ/xmArJE07VQMiDkMEjkBUXM_HBNRkifrEECXIkZKUZjcxKHVoqS2chO1UUredC8ggNiWunypMFEn0NHFAPbyTKz6gDxG-2BxuQayHq33uH6haoI6P4iup6V2sqspsOwjyJML_FNX9ayfpwVngb1NZQQ/qKxA6mcIsAYmx-TOkQ_NCsS13B70Hp3j8uXM-g3Zdrc$x$ where name = $x$Sam Howard$x$;
update players set photo_url = $x$https://v5.airtableusercontent.com/v3/u/55/55/1785420000000/a2fmx15H7QfAI4PbW_VV_g/VX8Cxe_uPqjsWU81n70yo9KwC7Yki7CUxSUQT_RJ9XFF9zSrRcsR4uuLlBv4RvpfS-wx3fo2PilU6RPadg5CQ1tDbbYaDkaSGNzDBVRlP3jzEZG3Jf_CqE4muKX_LvBNQ6YBQYzkN75-9y-Y3XyYYA/SHWpmCORJHeXt4LH2hYWTOvW3-skcnGO5LBtHpOHUpo$x$ where name = $x$Charlie Bee$x$;
update players set photo_url = $x$https://v5.airtableusercontent.com/v3/u/55/55/1785420000000/OFZWoGf2e5NJ9yuQxwexXQ/wQWtHZMaLs-per4mtiLoUQ0DW3QIar477tWFHnov3jbE7FNed6WRBlbd6SVNF1KuRxEbMyka_EiCmGMIl_VNuua10W3hVNu5wIIIH3wFoFNu_Q6E3OVGlx4ewpz8NR8BMM_-BLnv8ytDV5XPf6HMYw/biIZCSqz8Lg1heTQlHCzs3vhjUfWsWKCQiSrDX9zghk$x$ where name = $x$Charlie Oretti$x$;
update players set photo_url = $x$https://v5.airtableusercontent.com/v3/u/55/55/1785420000000/sP7pkqwh3P-PBofvgbXA7g/fKUE-A1h_COwBgCBTAdjzPj0ZzaFvo6oETsYYb4WqTDeac46U41HVWNiJQwidRMD1CmBtqLKR3Tm3fExRDR8EFgzKyhFT_PvnqVXJyXGWah6aLVq1qC_crxAlfvNrsJTS2gurELLiEq1jC2eJ3x34w/GWLcRzwKlthO0DaPdxdyQ7mX4wliFerVkacJ-TCyX9A$x$ where name = $x$Fernando Yageous Beoguios$x$;

-- ---- 3b. recruiter: "Who bought you into the club?" ----------------------
alter table players add column if not exists recruited_by text;
update players set recruited_by = $x$Harry Wetherald$x$ where name = $x$Alex Monk$x$;
update players set recruited_by = $x$Harry Wetherald$x$ where name = $x$Ario Aribaldi$x$;
update players set recruited_by = $x$Hugo Hensley$x$ where name = $x$Jon from Hugo's work$x$;
update players set recruited_by = $x$Sam Broadey$x$ where name = $x$Mark Hattersley$x$;
update players set recruited_by = $x$Sam Broadey$x$ where name = $x$Toby Chelton$x$;
update players set recruited_by = $x$Ozzy O'Sullivan$x$ where name = $x$George McCrae$x$;
update players set recruited_by = $x$Ozzy O'Sullivan$x$ where name = $x$Fed$x$;
update players set recruited_by = $x$Sam Broadey$x$ where name = $x$James Brown (JB)$x$;
update players set recruited_by = $x$Ozzy O'Sullivan$x$ where name = $x$Jamie Slevin$x$;
update players set recruited_by = $x$Joe Day$x$ where name = $x$Nick Sacqui$x$;
update players set recruited_by = $x$Joe Day$x$ where name = $x$Matt Morrison$x$;
update players set recruited_by = $x$Ozzy O'Sullivan$x$ where name = $x$Alec Schaefer$x$;
update players set recruited_by = $x$Sam Broadey$x$ where name = $x$Matty Naylor$x$;
update players set recruited_by = $x$Hugo Hensley$x$ where name = $x$Scott from Hugo’s work$x$;
update players set recruited_by = $x$Sam Broadey$x$ where name = $x$Jonni Shen$x$;
update players set recruited_by = $x$Harry Wetherald$x$ where name = $x$Scotty$x$;
update players set recruited_by = $x$Alex Monk$x$ where name = $x$Mannat$x$;
update players set recruited_by = $x$Fred Bouttell$x$ where name = $x$Joe Bouttell$x$;
update players set recruited_by = $x$Sam Broadey$x$ where name = $x$Rhory Ashworth$x$;
update players set recruited_by = $x$Sam Broadey$x$ where name = $x$Ed Smith$x$;
update players set recruited_by = $x$Ozzy O'Sullivan$x$ where name = $x$Tom Medlicott$x$;
update players set recruited_by = $x$Ozzy O'Sullivan$x$ where name = $x$Sam Howard$x$;
update players set recruited_by = $x$Jamie Slevin$x$ where name = $x$Gabe$x$;
update players set recruited_by = $x$Harry Wetherald$x$ where name = $x$Niall$x$;
update players set recruited_by = $x$Ozzy O'Sullivan$x$ where name = $x$Charlie Bee$x$;
update players set recruited_by = $x$Harry Wetherald$x$ where name = $x$Chris O'Halloran$x$;
update players set recruited_by = $x$Sam Broadey$x$ where name = $x$Walid Ahmad$x$;
update players set recruited_by = $x$Joe Day$x$ where name = $x$Jack Roberts$x$;
update players set recruited_by = $x$Nick Sacqui$x$ where name = $x$Daryl$x$;
update players set recruited_by = $x$Hugo Hensley$x$ where name = $x$Armani$x$;
update players set recruited_by = $x$Nick Sacqui$x$ where name = $x$Conor$x$;
update players set recruited_by = $x$Sam Broadey$x$ where name = $x$Liam Winterhouse$x$;
update players set recruited_by = $x$Ozzy O'Sullivan$x$ where name = $x$Roman C$x$;
update players set recruited_by = $x$Hugo Hensley$x$ where name = $x$Doug$x$;
update players set recruited_by = $x$Ozzy O'Sullivan$x$ where name = $x$Dan Burkitt$x$;
update players set recruited_by = $x$Joe Day$x$ where name = $x$Nick M$x$;
update players set recruited_by = $x$Nick Sacqui$x$ where name = $x$Sid$x$;
update players set recruited_by = $x$Jack Hobbs$x$ where name = $x$Jack Hobb's ringer Dan$x$;
update players set recruited_by = $x$Sam Broadey$x$ where name = $x$Jamie Shaw$x$;
update players set recruited_by = $x$Sam Broadey$x$ where name = $x$Charlie Oretti$x$;
update players set recruited_by = $x$Ozzy O'Sullivan$x$ where name = $x$Fernando Yageous Beoguios$x$;
update players set recruited_by = $x$Harry Sturgess$x$ where name = $x$Irish Simón$x$;
update players set recruited_by = $x$Alex Monk$x$ where name = $x$Yousif$x$;
update players set recruited_by = $x$Harry Sturgess$x$ where name = $x$John Hamlin$x$;
update players set recruited_by = $x$Jon from Hugo's work$x$ where name = $x$Faz$x$;
update players set recruited_by = $x$Jon from Hugo's work$x$ where name = $x$Basil$x$;
update players set recruited_by = $x$Sam Broadey$x$ where name = $x$Danimals's Fabs$x$;
update players set recruited_by = $x$Ozzy O'Sullivan$x$ where name = $x$Jack Contro$x$;
update players set recruited_by = $x$Joe Day$x$ where name = $x$Kris Ringer$x$;
update players set recruited_by = $x$Scott from Hugo’s work$x$ where name = $x$Charlie White$x$;
update players set recruited_by = $x$Justin Hubbard$x$ where name = $x$Rhidian$x$;
update players set recruited_by = $x$Alex Monk$x$ where name = $x$Toby Morris$x$;
update players set recruited_by = $x$Sam Broadey$x$ where name = $x$Fred Haffenden$x$;

commit;

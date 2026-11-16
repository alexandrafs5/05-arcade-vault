update public.games set sort_order = sort_order + 1000 where id = 'rocas';
insert into public.games (id, title, short, "long", cat, cover, color, sort_order, created_at)
select 'asteroids', title, short, "long", cat, 'cover-asteroids', color, sort_order - 1000, created_at from public.games where id = 'rocas';
update public.scores set game_id = 'asteroids' where game_id = 'rocas';
delete from public.games where id = 'rocas';

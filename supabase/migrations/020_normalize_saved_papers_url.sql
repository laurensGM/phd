-- Normalize saved_papers.url: trim leading/trailing whitespace so exact and DOI-based matching work reliably
update public.saved_papers
set url = trim(url)
where url is not null and url <> trim(url);

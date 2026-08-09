# bundle exec jekyll clean
# bundle exec jekyll serve --livereload
# bundle exec jekyll serve --config _config.yml,_config_dev.yml --livereload
# cd docs && bundle exec jekyll serve

clean:
	cd docs && bundle exec jekyll clean

start:
	cd docs && bundle exec jekyll serve --livereload

build:
	cd docs && JEKYLL_ENV=production bundle exec jekyll build
FROM php:8.2-apache
RUN docker-php-ext-install pdo pdo_pgsql
RUN a2enmod rewrite
COPY api/ /var/www/html/api/
EXPOSE 80

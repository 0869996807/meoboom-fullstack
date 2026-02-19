FROM php:8.2-apache

# Cài PostgreSQL libs
RUN apt-get update && apt-get install -y \
    libpq-dev \
    unzip \
    git \
    && docker-php-ext-install pdo pdo_pgsql pgsql

# Enable apache rewrite
RUN a2enmod rewrite

# Copy source
COPY . /var/www/html/

WORKDIR /var/www/html

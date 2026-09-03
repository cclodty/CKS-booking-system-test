FROM php:8.2-apache

# 本專案只需要 pdo_mysql；其餘皆為 PHP 內建
RUN docker-php-ext-install pdo_mysql \
    && a2enmod rewrite headers

# Apache 讀取目錄內的 .htaccess（用來擋住 config/ src/ database/）
RUN printf '<Directory /var/www/html>\n    AllowOverride All\n</Directory>\n' \
    > /etc/apache2/conf-available/booking.conf \
    && a2enconf booking

WORKDIR /var/www/html

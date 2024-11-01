// src/containers/EditListingPage/EditListingWizard/EditListingDetailsPanel/EditListingDetailsForm.js

import React, { useState, useEffect } from 'react';
import { arrayOf, bool, func, shape, string } from 'prop-types';
import { compose } from 'redux';
import { Field, Form as FinalForm } from 'react-final-form';
import arrayMutators from 'final-form-arrays';
import classNames from 'classnames';
import { CircularProgress, Icon, IconButton, Stack } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

// Import util modules
import { intlShape, injectIntl, FormattedMessage } from '../../../../util/reactIntl';
import { EXTENDED_DATA_SCHEMA_TYPES, propTypes } from '../../../../util/types';
import { isFieldForCategory, isFieldForListingType } from '../../../../util/fieldHelpers';
import { maxLength, required, composeValidators } from '../../../../util/validators';
import { generateListingDescription } from '../../../../util/api';


// Import shared components
import {
  Form,
  Button,
  FieldSelect,
  FieldTextInput,
  Heading,
  CustomExtendedDataField,
} from '../../../../components';
// Import modules from this directory
import css from './EditListingDetailsForm.module.css';

//Hire Marketplace
import ProductSelection from '../ProductSelection';


const TITLE_MAX_LENGTH = 60;

// Show various error messages
const ErrorMessage = props => {
  const { fetchErrors } = props;
  const { updateListingError, createListingDraftError, showListingsError } = fetchErrors || {};
  const errorMessage = updateListingError ? (
    <FormattedMessage id="EditListingDetailsForm.updateFailed" />
  ) : createListingDraftError ? (
    <FormattedMessage id="EditListingDetailsForm.createListingDraftError" />
  ) : showListingsError ? (
    <FormattedMessage id="EditListingDetailsForm.showListingFailed" />
  ) : null;

  if (errorMessage) {
    return <p className={css.error}>{errorMessage}</p>;
  }
  return null;
};

// Hidden input field
const FieldHidden = props => {
  const { name } = props;
  return (
    <Field id={name} name={name} type="hidden" className={css.unitTypeHidden}>
      {fieldRenderProps => <input {...fieldRenderProps?.input} />}
    </Field>
  );
};

// Field component that either allows selecting listing type (if multiple types are available)
// or just renders hidden fields:
// - listingType              Set of predefined configurations for each listing type
// - transactionProcessAlias  Initiate correct transaction against Marketplace API
// - unitType                 Main use case: pricing unit
const FieldSelectListingType = props => {
  const {
    name,
    listingTypes,
    hasExistingListingType,
    onListingTypeChange,
    formApi,
    formId,
    intl,
  } = props;
  const hasMultipleListingTypes = listingTypes?.length > 1;

  const handleOnChange = value => {
    const selectedListingType = listingTypes.find(config => config.listingType === value);
    formApi.change('transactionProcessAlias', selectedListingType.transactionProcessAlias);
    formApi.change('unitType', selectedListingType.unitType);

    if (onListingTypeChange) {
      onListingTypeChange(selectedListingType);
    }
  };
  const getListingTypeLabel = listingType => {
    const listingTypeConfig = listingTypes.find(config => config.listingType === listingType);
    return listingTypeConfig ? listingTypeConfig.label : listingType;
  };

  return hasMultipleListingTypes && !hasExistingListingType ? (
    <>
      <FieldSelect
        id={formId ? `${formId}.${name}` : name}
        name={name}
        className={css.listingTypeSelect}
        label={intl.formatMessage({ id: 'EditListingDetailsForm.listingTypeLabel' })}
        validate={required(
          intl.formatMessage({ id: 'EditListingDetailsForm.listingTypeRequired' })
        )}
        onChange={handleOnChange}
      >
        <option disabled value="">
          {intl.formatMessage({ id: 'EditListingDetailsForm.listingTypePlaceholder' })}
        </option>
        {listingTypes.map(config => {
          const type = config.listingType;
          return (
            <option key={type} value={type}>
              {config.label}
            </option>
          );
        })}
      </FieldSelect>
      <FieldHidden name="transactionProcessAlias" />
      <FieldHidden name="unitType" />
    </>
  ) : hasMultipleListingTypes && hasExistingListingType ? (
    <div className={css.listingTypeSelect}>
      <Heading as="h5" rootClassName={css.selectedLabel}>
        {intl.formatMessage({ id: 'EditListingDetailsForm.listingTypeLabel' })}
      </Heading>
      <p className={css.selectedValue}>{getListingTypeLabel(formApi.getFieldState(name)?.value)}</p>
      <FieldHidden name={name} />
      <FieldHidden name="transactionProcessAlias" />
      <FieldHidden name="unitType" />
    </div>
  ) : (
    <>
      <FieldHidden name={name} />
      <FieldHidden name="transactionProcessAlias" />
      <FieldHidden name="unitType" />
    </>
  );
};

// Finds the correct subcategory within the given categories array based on the provided categoryIdToFind.
const findCategoryConfig = (categories, categoryIdToFind) => {
  return categories?.find(category => category.id === categoryIdToFind);
};

/**
 * Recursively render subcategory field inputs if there are subcategories available.
 * This function calls itself with updated props to render nested category fields.
 * The select field is used for choosing a category or subcategory.
 */
const CategoryField = props => {
  const { currentCategoryOptions, level, values, prefix, handleCategoryChange, intl } = props;

  const currentCategoryKey = `${prefix}${level}`;

  const categoryConfig = findCategoryConfig(currentCategoryOptions, values[`${prefix}${level}`]);

  return (
    <>
      {currentCategoryOptions ? (
        <FieldSelect
          key={currentCategoryKey}
          id={currentCategoryKey}
          name={currentCategoryKey}
          className={css.listingTypeSelect}
          onChange={event => handleCategoryChange(event, level, currentCategoryOptions)}
          label={intl.formatMessage(
            { id: 'EditListingDetailsForm.categoryLabel' },
            { categoryLevel: currentCategoryKey }
          )}
          validate={required(
            intl.formatMessage(
              { id: 'EditListingDetailsForm.categoryRequired' },
              { categoryLevel: currentCategoryKey }
            )
          )}
        >
          <option disabled value="">
            {intl.formatMessage(
              { id: 'EditListingDetailsForm.categoryPlaceholder' },
              { categoryLevel: currentCategoryKey }
            )}
          </option>

          {currentCategoryOptions.map(option => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </FieldSelect>
      ) : null}

      {categoryConfig?.subcategories?.length > 0 ? (
        <CategoryField
          currentCategoryOptions={categoryConfig.subcategories}
          level={level + 1}
          values={values}
          prefix={prefix}
          handleCategoryChange={handleCategoryChange}
          intl={intl}
        />
      ) : null}
    </>
  );
};

const FieldSelectCategory = props => {
  useEffect(() => {
    checkIfInitialValuesExist();
  }, []);

  const { prefix, listingCategories, formApi, intl, setAllCategoriesChosen, values, handleProductSelect } = props;

  // Counts the number of selected categories in the form values based on the given prefix.
  const countSelectedCategories = () => {
    return Object.keys(values).filter(key => key.startsWith(prefix)).length;
  };

  // Checks if initial values exist for categories and sets the state accordingly.
  // If initial values exist, it sets `allCategoriesChosen` state to true; otherwise, it sets it to false
  const checkIfInitialValuesExist = () => {
    const count = countSelectedCategories(values, prefix);
    setAllCategoriesChosen(count > 0);
  };

  // If a parent category changes, clear all child category values
  const handleCategoryChange = (category, level, currentCategoryOptions) => {
    handleProductSelect('');
    // console.log('handleCategoryChange triggered with:', category);
    const selectedCatLenght = countSelectedCategories();
    // console.log('category:', category);
    if (level < selectedCatLenght) {
      for (let i = selectedCatLenght; i > level; i--) {
        formApi.change(`${prefix}${i}`, null);
      }
    }
    const categoryConfig = findCategoryConfig(currentCategoryOptions, category).subcategories;
    setAllCategoriesChosen(!categoryConfig || categoryConfig.length === 0);
  };

  return (
    <CategoryField
      currentCategoryOptions={listingCategories}
      level={1}
      values={values}
      prefix={prefix}
      handleCategoryChange={handleCategoryChange}
      intl={intl}
    />
  );
};

// Add collect data for listing fields (both publicData and privateData) based on configuration
const AddListingFields = props => {
  const { listingType, listingFieldsConfig, selectedCategories, formId, intl } = props;
  const targetCategoryIds = Object.values(selectedCategories);

  const fields = listingFieldsConfig.reduce((pickedFields, fieldConfig) => {
    const { key, schemaType, scope } = fieldConfig || {};
    const namespacedKey = scope === 'public' ? `pub_${key}` : `priv_${key}`;

    const isKnownSchemaType = EXTENDED_DATA_SCHEMA_TYPES.includes(schemaType);
    const isProviderScope = ['public', 'private'].includes(scope);
    const isTargetListingType = isFieldForListingType(listingType, fieldConfig);
    const isTargetCategory = isFieldForCategory(targetCategoryIds, fieldConfig);

    // // Hide product family and id fields
    // if (namespacedKey === 'pub_product_family' || namespacedKey === 'pub_product_id') {
    //   return [
    //     ...pickedFields,
    //     <FieldHidden key={namespacedKey} name={namespacedKey} />,
    //   ];
    // }

    return isKnownSchemaType && isProviderScope && isTargetListingType && isTargetCategory
      ? [
        ...pickedFields,
        <CustomExtendedDataField
          key={namespacedKey}
          name={namespacedKey}
          fieldConfig={fieldConfig}
          defaultRequiredMessage={intl.formatMessage({
            id: 'EditListingDetailsForm.defaultRequiredMessage',
          })}
          formId={formId}
          disabled={namespacedKey === 'pub_year' ? false : true} // Disable all custom fields except for year (Year of Manufacture)
        />,
      ]
      : pickedFields;
  }, []);

  return <>{fields}</>;
};

// Form that asks title, description, transaction process and unit type for pricing
// In addition, it asks about custom fields according to marketplace-custom-config.js
const EditListingDetailsFormComponent = props => {
  const [productId, setProductId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [productFamily, setProductFamily] = useState('');
  const [productData, setProductData] = useState({});
  const [descriptionLoading, setDescriptionLoading] = useState(false);

  const handleProductSelect = (id) => {
    // console.log('handleProductSelect triggered with:', id);
    setProductId(id);
  };

  return (
    <FinalForm
      {...props}
      mutators={{ ...arrayMutators }}
      render={formRenderProps => {
        const {
          autoFocus,
          className,
          disabled,
          ready,
          formId,
          form: formApi,
          handleSubmit,
          onListingTypeChange,
          intl,
          invalid,
          pristine,
          selectableListingTypes,
          selectableCategories,
          hasExistingListingType,
          pickSelectedCategories,
          categoryPrefix,
          saveActionMsg,
          updated,
          updateInProgress,
          fetchErrors,
          listingFieldsConfig,
          values,
        } = formRenderProps;

        // useEffect(() => {
        //   if (productId) {
        //     formApi.change('pub_product_id', productId);
        //   }
        // }, [productId, formApi]);

        const changeProductIdField = (productId) => {
          formApi.change('pub_product_id', productId);
        };

        useEffect(() => {
          if (values.categoryLevel1) {
            setSelectedCategory(values.categoryLevel1);
          }
        }, [values]);


       // Update form fields with product data from product library selection
        useEffect(() => {
          // console.log('productData effect triggered with:', productData);

          if (productData) {
            // console.log('listingFieldsConfig:', listingFieldsConfig);
            listingFieldsConfig.forEach(field => {
              if (field.key !== `product_id` && field.key !== `year`) {
                formApi.change(`pub_${field.key}`, null);
                // console.log(`pub_${field.key} set to null:`);
              }
              if (productData && productData.manufacturer && productData.model) {
                formApi.change('title', productData.manufacturer + ' - ' + productData.model);
              }
            });

            Object.keys(productData).forEach(key => {
              
              const namespacedKey = `pub_${key}`;
              if (values[namespacedKey] !== undefined && values[namespacedKey] !== `pub_product_id`) { // Ensure the form has this field
                const fieldConfig = listingFieldsConfig.find(field => {
                  const configKey = field.scope === 'public' ? `pub_${field.key}` : `priv_${field.key}`;
                  return configKey === namespacedKey;
                });

                // If field configuration is found
                if (fieldConfig) {
                  console.log('fieldconfig:', fieldConfig);
                  try {
                    let valueToSet = productData[key];

                    // Convert string to number if field type is 'Number'
                    if (fieldConfig.schemaType === 'long' && typeof valueToSet === 'string') {
                      valueToSet = parseFloat(valueToSet);

                      if (isNaN(valueToSet)) { // Check if conversion was successful
                        throw new Error(`Failed to convert value for ${namespacedKey} to a number.`);
                      } 
                    }

                    // Multiply by 100 if the key ends in '_m' to convert from metres to centimetres
                    if (key.endsWith('_m') && typeof valueToSet === 'number') {
                      valueToSet = Math.round(valueToSet * 100);
                      console.log(`Converted ${key} value to centimetres: ${valueToSet}`);
                    }

                    console.log(`Updating field ${namespacedKey} with value ${valueToSet}`);
                    formApi.change(namespacedKey, valueToSet);
                  } catch (error) {
                    console.error(`Error updating field ${namespacedKey}:`, error);
                  }
                } else {
                  console.warn(`No field configuration found for key: ${namespacedKey}`);
                }
              } else {
                // console.warn(`Form does not contain a field for key: ${namespacedKey}`);
              }
            });
          }
        }, [productData]);


        useEffect(() => {
          // setProductFamily(values.pub_product_family);
          setProductId(values.pub_product_id);
          console.log('ProductId Set:', values.pub_product_id);
        }, []);

        const handleGenerateDescription = () => {
          console.log('handleGenerateDescription triggered');
          setDescriptionLoading(true);
          if (productData && productData.manufacturer && productData.model) {
            const manufacturer = productData.manufacturer;
            const model = productData.model;
            const productFamily = values.categoryLevel1;
            console.log('handleGenerateDescription with:', productFamily + ' - ' + manufacturer + ' - ' + model);
            generateListingDescription({ manufacturer, model, productFamily })
              .then(response => {
                console.log('Response from generateListingDescription:', response);
                console.log('response.data:', response.data);
                setDescriptionLoading(false);
                if (response.data.description) {
                  formApi.change('description', response.data.description);
                }
              })
              .catch(error => {
                console.error('Error generating description:', error);
                setDescriptionLoading(false);
              })
          }

        };

        const { listingType, transactionProcessAlias, unitType } = values;
        const [allCategoriesChosen, setAllCategoriesChosen] = useState(false);

        const titleRequiredMessage = intl.formatMessage({
          id: 'EditListingDetailsForm.titleRequired',
        });
        const locationRequiredMessage = intl.formatMessage({
          id: 'EditListingDetailsForm.locationRequired',
        });
        const maxLengthMessage = intl.formatMessage(
          { id: 'EditListingDetailsForm.maxLength' },
          {
            maxLength: TITLE_MAX_LENGTH,
          }
        );
        const maxLength60Message = maxLength(maxLengthMessage, TITLE_MAX_LENGTH);

        const hasCategories = selectableCategories && selectableCategories.length > 0;
        const showCategories = listingType && hasCategories;

        const showTitle = hasCategories ? allCategoriesChosen : listingType;
        const showDescription = hasCategories ? allCategoriesChosen : listingType;
        const showListingFields = hasCategories ? allCategoriesChosen : listingType;

        const classes = classNames(css.root, className);
        const submitReady = (updated && pristine) || ready;
        const submitInProgress = updateInProgress;
        const hasMandatoryListingTypeData = listingType && transactionProcessAlias && unitType;
        const submitDisabled =
          invalid || disabled || submitInProgress || !hasMandatoryListingTypeData;

        return (
          <Form className={classes} onSubmit={handleSubmit}>
            <ErrorMessage fetchErrors={fetchErrors} />

            <FieldSelectListingType
              name="listingType"
              listingTypes={selectableListingTypes}
              hasExistingListingType={hasExistingListingType}
              onListingTypeChange={onListingTypeChange}
              formApi={formApi}
              formId={formId}
              intl={intl}
            />

            {showCategories ? (
              <FieldSelectCategory
                values={values}
                prefix={categoryPrefix}
                listingCategories={selectableCategories}
                formApi={formApi}
                intl={intl}
                allCategoriesChosen={allCategoriesChosen}
                setAllCategoriesChosen={setAllCategoriesChosen}
                handleProductSelect={handleProductSelect}
              />
            ) : null}


            {showListingFields ? (
              <>
                <ProductSelection
                  onProductSelect={handleProductSelect}
                  productId={productId}
                  productFamily={selectedCategory}
                  setProductData={setProductData}
                  changeProductIdField={changeProductIdField}
                />
                {/* <button onClick={() => console.log(values)}>Log Values</button> */}
                {/* <button onClick={() => console.log('selectedCategory:', selectedCategory)}>Log selectedCategory</button> */}
                {/* <button onClick={() => console.log('product data:', productData)}>Log Product Data</button> */}
                {/* <button onClick={() => console.log('productId:', productId)}>Log productId</button> */}
              </>
            ) : null}


            {showTitle ? (
              <FieldTextInput
                id={`${formId}title`}
                name="title"
                className={css.title}
                type="text"
                label={intl.formatMessage({ id: 'EditListingDetailsForm.title' })}
                placeholder={intl.formatMessage({ id: 'EditListingDetailsForm.titlePlaceholder' })}
                maxLength={TITLE_MAX_LENGTH}
                validate={composeValidators(required(titleRequiredMessage), maxLength60Message)}
                autoFocus={autoFocus}
              />
            ) : null}

              {/* <FieldTextInput
                id={`${formId}location`}
                name="location"
                className={css.title}
                type="text"
                label={intl.formatMessage({ id: 'EditListingDetailsForm.location' })}
                placeholder={intl.formatMessage({ id: 'EditListingDetailsForm.locationPlaceholder' })}
                maxLength={TITLE_MAX_LENGTH}
                validate={composeValidators(required(locationRequiredMessage), maxLength60Message)}
              /> */}

            {showDescription ? (
              <Stack direction="row" spacing={2} alignItems="center" className={css.descriptionContainer}>
                <FieldTextInput
                  id={`${formId}description`}
                  name="description"
                  className={css.description}
                  type="textarea"
                  label={intl.formatMessage({ id: 'EditListingDetailsForm.description' })}
                  placeholder={intl.formatMessage({
                    id: 'EditListingDetailsForm.descriptionPlaceholder',
                  })}
                  validate={required(
                    intl.formatMessage({
                      id: 'EditListingDetailsForm.descriptionRequired',
                    })
                  )}
                />
                <IconButton className={css.iconButton} aria-label="Generate description" onClick={() => handleGenerateDescription()} disabled={descriptionLoading}>
                  <AutoAwesomeIcon />
                </IconButton>
              </Stack>
            ) : null}

            {showListingFields ? (
              <AddListingFields
                listingType={listingType}
                listingFieldsConfig={listingFieldsConfig}
                selectedCategories={pickSelectedCategories(values)}
                formId={formId}
                intl={intl}
              />
            ) : null}

            <Button
              className={css.submitButton}
              type="submit"
              inProgress={submitInProgress}
              disabled={submitDisabled}
              ready={submitReady}
            >
              {saveActionMsg}
            </Button>
          </Form>
        );
      }}
    />
  );
};

EditListingDetailsFormComponent.defaultProps = {
  className: null,
  formId: 'EditListingDetailsForm',
  fetchErrors: null,
  hasExistingListingType: false,
  listingFieldsConfig: [],
};

EditListingDetailsFormComponent.propTypes = {
  className: string,
  formId: string,
  intl: intlShape.isRequired,
  onSubmit: func.isRequired,
  onListingTypeChange: func.isRequired,
  saveActionMsg: string.isRequired,
  disabled: bool.isRequired,
  ready: bool.isRequired,
  updated: bool.isRequired,
  updateInProgress: bool.isRequired,
  fetchErrors: shape({
    createListingDraftError: propTypes.error,
    showListingsError: propTypes.error,
    updateListingError: propTypes.error,
  }),
  pickSelectedCategories: func.isRequired,
  selectableListingTypes: arrayOf(
    shape({
      listingType: string.isRequired,
      transactionProcessAlias: string.isRequired,
      unitType: string.isRequired,
    })
  ).isRequired,
  hasExistingListingType: bool,
  listingFieldsConfig: propTypes.listingFields,
};

export default compose(injectIntl)(EditListingDetailsFormComponent);
